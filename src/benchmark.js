'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const readline = require('readline');

const parseTrace = require('./trace.js');
const util = require('./util.js')

let errorMsg = '';
const errorMsgMaxLength = 200;

function cartesianProduct(arr) {
  return arr.reduce(function (a, b) {
    return a
      .map(function (x) {
        return b.map(function (y) {
          return x.concat([y]);
        })
      })
      .reduce(function (a, b) {
        return a.concat(b)
      }, [])
  }, [[]])
}

function intersect(a, b) {
  if (!Array.isArray(a)) {
    a = [a];
  }
  if (!Array.isArray(b)) {
    b = [b];
  }
  return a.filter(v => b.includes(v));
}

async function startContext(traceFile = undefined) {
  let extraBrowserArgs = '';
  if ('trace' in util.args) {
    extraBrowserArgs = `--trace-startup-file=${traceFile}`;
  }

  if (!util.dryrun) {
    let context = await puppeteer.launch({
      args: util['browserArgs'].split(' ').concat(extraBrowserArgs.split(' ')),
      defaultViewport: null,
      executablePath: util['browserPath'],
      headless: false,
      ignoreHTTPSErrors: true,
      userDataDir: util.userDataDir,
    });
    let page = await context.newPage();
    page.on('console', async msg => {
      for (let i = 0; i < msg.args().length; ++i) {
        const consoleError =
          `[console] ${i}: ${await msg.args()[i].jsonValue()}`;
        if (consoleError.search(
          'Blocking on the main thread is very dangerous')) {
          continue;
        }
        util.log(consoleError);
        errorMsg += `${consoleError.substring(0, errorMsgMaxLength)}<br>`;
      }
    });
    page.on('pageerror', (error) => {
      util.hasError = true;
      const pageError = `[pageerror] ${error}`;
      util.log(pageError);
      errorMsg += `${pageError.substring(0, errorMsgMaxLength)}<br>`;
    });

    return [context, page];
  } else {
    return [undefined, undefined];
  }
}

async function closeContext(context) {
  if (!util.dryrun) {
    await context.close();
  }
}

async function runBenchmark(task) {
  // get benchmarks
  let benchmarks = [];
  let benchmarkJson =
    path.join(path.resolve(__dirname), util.args['benchmark-json']);
  let taskConfigs = JSON.parse(fs.readFileSync(benchmarkJson));

  for (let modelName in taskConfigs) {
    let config = {};
    if ('model-name' in util.args) {
      config['modelName'] =
        intersect(modelName, util.args['model-name'].split(','));
    } else {
      config['modelName'] = modelName;
    }
    if (!config['modelName']) {
      continue;
    }

    if (task === 'conformance') {
      if ('conformance-ep' in util.args) {
        config['ep'] = util.args['conformance-ep'].split(',');
      } else {
        // eps in json file are ignored for conformance
        config['ep'] = ['webgpu'];
      }
      for (let ep of config['ep']) {
        if (util.conformanceEps.indexOf(ep) < 0) {
          util.conformanceEps.push(ep);
        }
      }
    } else if (task === 'performance') {
      if ('performance-ep' in util.args) {
        config['ep'] = util.args['performance-ep'].split(',');
      } else {
        config['ep'] = taskConfigs[modelName];
        if (util.hostname !== 'shwdeweb1303' && util.hostname !== 'shwde6666' && util.hostname !== 'shwde9106') {
          let index = config['ep'].indexOf('webnn');
          if (index >= 0) {
            config['ep'].splice(index, 1);
          }
        }
      }
      for (let ep of config['ep']) {
        if (util.performanceEps.indexOf(ep) < 0) {
          util.performanceEps.push(ep);
        }
      }
    }

    let seqArray = [];
    for (let p of util.parameters) {
      seqArray.push(
        p in config ? (Array.isArray(config[p]) ? config[p] : [config[p]]) :
          ['']);
    }
    benchmarks = benchmarks.concat(cartesianProduct(seqArray));
  }

  // run benchmarks
  let benchmarksLength = benchmarks.length;
  let previousModelName = '';

  // format: testName, first_webgpu, average_webgpu, best_webgpu, first_wasm, average_wasm, best_wasm, first_webnn, average_webnn, best_webnn {op: {webgpu, wasm}}
  let results = [];
  let defaultValue = 'NA';
  let epsLength = util.allEps.length;
  let metrics = util.taskMetrics[task];
  if (task === 'performance' && util.runTimes === 0) {
    metrics.length = 1;
  }
  let metricsLength = metrics.length;
  // for errorMsg
  let resultMetricsLength = metricsLength;
  if (task === 'conformance') {
    resultMetricsLength += 1;
  }
  let context;
  let page;

  if (!('new-context' in util.args)) {
    [context, page] = await startContext();
  }

  for (let i = 0; i < benchmarksLength; i++) {
    let benchmark = benchmarks[i];
    let modelName = benchmark.slice(0, -1).join('-');
    let ep = benchmark[benchmark.length - 1];
    let epIndex = util.allEps.indexOf(ep);

    util.log(`[${i + 1}/${benchmarksLength}] ${benchmark}`);

    if ('new-context' in util.args) {
      let traceFile = undefined;
      if ('trace' in util.args) {
        traceFile = `${util.timestampDir}/${benchmark.join('-').replace(/ /g, '_')}-trace.json`;
      }
      [context, page] = await startContext(traceFile);
    }

    // prepare result placeholder
    if (modelName != previousModelName) {
      let placeholder = [modelName].concat(
        Array(epsLength * resultMetricsLength).fill(defaultValue));
      if (task === 'performance' && util.breakdown) {
        placeholder = placeholder.concat({});
      }
      results.push(placeholder);
      previousModelName = modelName;
    }
    let result = results[results.length - 1];

    if (util.dryrun) {
      let metricIndex = 0;
      while (metricIndex < metricsLength) {
        if (task === 'conformance') {
          result[epIndex * resultMetricsLength + metricIndex + 1] = 'true';
        } else if (task === 'performance') {
          let tmpIndex = epIndex * resultMetricsLength + metricIndex;
          result[tmpIndex + 1] = tmpIndex + 1;
          let op_time = result[epsLength * resultMetricsLength + 1];
          for (let i = 0; i < 3; i++) {
            let op = `op${i}`;
            if (!(op in op_time)) {
              op_time[op] = Array(epsLength).fill(defaultValue);
            }
            op_time[op][epIndex] = i * epsLength + epIndex + 1;
          }
        }
        metricIndex += 1;
      }
    } else {
      // get url
      let url =
        `${util.toolkitUrl}?tasks=${task}`;
      for (let index = 0; index < util.parameters.length; index++) {
        if (benchmarks[i][index]) {
          url += `&${util.parameters[index]}=${benchmarks[i][index]}`;
        }
      }
      url += `&${util.toolkitUrlArgs}`;
      if (task === 'performance') {
        let warmupTimes;
        if ('warmup-times' in util.args) {
          warmupTimes = parseInt(util.args['warmup-times']);
        } else {
          warmupTimes = 10;
        }
        util.warmupTimes = warmupTimes;

        let runTimes;
        if ('run-times' in util.args) {
          runTimes = parseInt(util.args['run-times']);
        } else {
          runTimes = 10;
        }
        util.runTimes = runTimes;
        url += `&warmupTimes=${warmupTimes}&runTimes=${runTimes}`;
      }

      if (ep === 'wasm') {
        url += `&wasmThreads=${util['wasmThreads']}`;
      }

      if (util.updateModelNames.indexOf(modelName) >= 0) {
        url += '&updateModel=true';
      }

      console.log(url);
      await page.goto(url);
      if (!('crossOriginIsolated' in util)) {
        util['crossOriginIsolated'] = await page.evaluate(() => crossOriginIsolated);
      }

      try {
        await page.waitForSelector('#result', { timeout: util.timeout });
      } catch (error) {
      }

      // handle errorMsg
      if (task === 'conformance') {
        results[results.length - 1][(epIndex + 1) * resultMetricsLength] =
          errorMsg;
      }
      errorMsg = '';

      // pause if needed
      if ('pause-test' in util.args) {
        const readlineInterface = readline.createInterface(
          { input: process.stdin, output: process.stdout });
        await new Promise(resolve => {
          readlineInterface.question('Press Enter to continue...\n', resolve);
        });
      }

      // quit with error
      if (util.hasError) {
        if (task === 'conformance') {
          results[results.length - 1][epIndex * resultMetricsLength + 1] =
            'false';
        }
        util.hasError = false;
        //continue;
      }

      // handle result
      let metricIndex = 0;
      let testResult = await page.$eval('#result', el => el.textContent);
      let testResults = JSON.parse(testResult);
      while (metricIndex < metricsLength) {
        results[results.length - 1][epIndex * resultMetricsLength + metricIndex + 1] = testResults[util.taskMetrics[task][metricIndex]];
        metricIndex += 1;
      }

      // get breakdown data
      if (task === 'performance' && util.breakdown) {
        try {
          await page.waitForSelector(
            '#kernels > tbody > tr:nth-child(1)', { timeout: util.timeout });
          let row = 1;
          while (true) {
            let op = await page.$eval(
              '#kernels > tbody > tr:nth-child(' + row +
              ') > td:nth-child(1) > span',
              el => el.title);
            if (op.substr(-4, 4) === '__op') {
              row += 1;
              continue;
            }
            let time = await page.$eval(
              '#kernels > tbody > tr:nth-child(' + row +
              ') > td:nth-child(2)',
              el => el.textContent);
            let op_time =
              results[results.length - 1][epsLength * resultMetricsLength + 1];
            if (!(op in op_time)) {
              op_time[op] = Array(epsLength).fill(defaultValue);
            }
            op_time[op][epIndex] = parseFloat(time);
            row += 1;
          }
        } catch (error) {
        }
      }
    }

    util.log(result);

    if ('new-context' in util.args) {
      await closeContext(context);
    }
  }

  if (!('new-context' in util.args)) {
    await closeContext(context);
  }

  if (task === 'performance') {
    let fileName = `${util.timestamp.substring(0, 8)}.json`;
    let file = path.join(util.timestampDir, fileName);
    fs.writeFileSync(file, JSON.stringify(results));
    if ('upload' in util.args) {
      // Ensure server has the device folder
      let serverFolder = `/workspace/project/work/ort/perf/${util.platform}/${util['gpuDeviceId']}`;
      let result = spawnSync(util.ssh, ['wp@wp-27.sh.intel.com', `ls ${serverFolder}`]);
      if (result.status != 0) {
        spawnSync(util.ssh, ['wp@wp-27.sh.intel.com', `mkdir -p ${serverFolder}`]);
      }

      result = spawnSync(util.scp, [
        file,
        `wp@wp-27.sh.intel.com:${serverFolder}`
      ]);
      if (result.status !== 0) {
        util.log('[ERROR] Failed to upload report');
      } else {
        util.log('[INFO] Report was successfully uploaded');
      }
    }
  }

  if ('trace' in util.args) {
    await parseTrace();
  }

  return Promise.resolve(results);
}

module.exports = runBenchmark;
