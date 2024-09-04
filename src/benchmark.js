'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const readline = require('readline');

const parseTrace = require('./trace.js');
const util = require('./util.js');

let errorMsg = '';
const errorMsgMaxLength = 200;

function cartesianProduct(arr) {
  return arr.reduce(function (a, b) {
    return a
      .map(function (x) {
        return b.map(function (y) {
          return x.concat([y]);
        });
      })
      .reduce(function (a, b) {
        return a.concat(b);
      }, []);
  }, [[]]);
}

async function startBrowser(traceFile = undefined) {
  let extraBrowserArgs = [];
  if ('enable-trace' in util.args) {
    extraBrowserArgs.push(`--trace-startup-file=${traceFile}`);
  }
  console.log(util['browserArgs'])
  let browser = await puppeteer.launch({
    args: util['browserArgs'].concat(extraBrowserArgs),
    defaultViewport: null,
    executablePath: util['browserPath'],
    headless: false,
    ignoreHTTPSErrors: true,
    userDataDir: util.userDataDir,
  });
  let page = await browser.newPage();
  page.on('console', async (msg) => {
    try {
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
    } catch (error) {
    }
  });
  page.on('pageerror', (error) => {
    const pageError = `[pageerror] ${error}`;

    // Temporarily skip some WebNN errors
    if (pageError.startsWith(
      '[pageerror] Error: TypeError: Failed to execute \'fetch\' on \'WorkerGlobalScope\'') ||
      pageError.startsWith('[pageerror] Error: ErrorEvent') ||
      pageError.startsWith('[pageerror] Error: null')) {
      return;
    }

    util.hasError = true;
    util.errorMsg = pageError;
    util.log(pageError);
    errorMsg += `${pageError.substring(0, errorMsgMaxLength)}<br>`;
  });

  return [browser, page];
}

async function closeBrowser(browser) {
  // browser.close hangs on some machines, and process.kill also has chance to
  // fail to start browser.

  // For trace, we have to use browser.close() for trace log
  if ('enable-trace' in util.args) {
    await browser.close();
    return;
  }

  try {
    util.asyncFunctionWithTimeout(await browser.close(), 10);
    console.log('Close the browser with browser.close');
  } catch (error) {
    console.log('Close the browser with process.kill');
    const pid = browser.process().pid;
    process.kill(pid);
  }
}

function getErrorResult(task) {
  if (task === 'conformance') {
    return '{"result": "[false]"}';
  } else if (task === 'performance') {
    return '{"first":"NA","average":"NA","best":"NA"}';
  }
}

function removeSlowEps(eps) {
  if (util.gpuVendorId === '8086') {
    let configLen = eps.length;
    for (let i = configLen - 1; i >= 0; i--) {
      if (eps[i].startsWith('webnn')) {
        eps.splice(i, 1);
      }
    }
  }
}

async function runBenchmark(task) {
  // get benchmarks
  let benchmarks = [];
  let benchmarkJson = path.join(path.resolve(__dirname), util.args['benchmark-json']);
  let taskConfigs = JSON.parse(fs.readFileSync(benchmarkJson));

  for (let modelName of taskConfigs) {
    let config = {};
    if ('model-name' in util.args) {
      config['modelName'] =
        util.intersect(modelName, util.args['model-name'].split(','));
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
        config['ep'] = structuredClone(util.allEps.filter(
          (item) => ['wasm'].indexOf(item) < 0));
        // removeSlowEps(config['ep']);
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
        config['ep'] = structuredClone(util.allEps);
        // removeSlowEps(config['ep']);
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

  // format: testName, (first, average, best) * (webgpu, wasm, webnn-gpu)
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
  let browser;
  let page;

  if ('disable-new-browser' in util.args) {
    [browser, page] = await startBrowser();
  }

  for (let i = 0; i < benchmarksLength; i++) {
    let benchmark = benchmarks[i];
    let modelName = benchmark.slice(0, -1).join('-');
    let ep = benchmark[benchmark.length - 1];
    let epIndex = util.allEps.indexOf(ep);
    let testResult;
    let traceFile;

    util.log(`[${i + 1}/${benchmarksLength}] ${benchmark}`);
    util.log(util.getTimestamp('second'));

    if (!('disable-new-browser' in util.args)) {
      if ('enable-trace' in util.args) {
        traceFile = `${util.timestampDir}/${benchmark.join('-').replace(/ /g, '_')}-trace.json`;
      }
      [browser, page] = await startBrowser(traceFile);
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

    // get url
    let url = `${util.toolkitUrl}?task=${task}`;

    for (let index = 0; index < util.parameters.length; index++) {
      if (benchmarks[i][index]) {
        if (util.parameters[index] === 'ep' &&
          benchmarks[i][index].startsWith('webnn')) {
          let deviceType = benchmarks[i][index].replace('webnn-', '');
          url += `&${util.parameters[index]}=webnn&deviceType=${deviceType}`;
          if (deviceType === 'cpu') {
            url += `&webnnNumThreads=${util['cpuThreads']}`;
          }
        } else {
          url += `&${util.parameters[index]}=${benchmarks[i][index]}`;
        }
      }
    }
    if (util.toolkitUrlArgs.length > 0) {
      url += `&${util.toolkitUrlArgs.join('&')}`;
    }
    url += `&modelUrl=${util.modelUrl}&ortUrl=${util.ortUrl}`;

    // update model
    if ([''].indexOf(modelName) >= 0) {
      url += '&updateModel=true';
    }

    if (task === 'conformance') {
      if (ep === 'webgpu') {
        url += '&runTimes=1';
      }
    } else if (task === 'performance') {
      url += `&warmupTimes=${util.warmupTimes}&runTimes=${util.runTimes}`;
    }

    url += `&wasmThreads=${util['cpuThreads']}`;

    if (util.updateModelNames.indexOf(modelName) >= 0) {
      url += '&updateModel=true';
    }

    console.log(url);

    try {
      await page.goto(url);
      if (!('crossOriginIsolated' in util)) {
        util['crossOriginIsolated'] =
          await page.evaluate(() => crossOriginIsolated);
      }

      const retryTimes = util.timeout / 1000;
      let retryTimesLeft = retryTimes;
      while (retryTimesLeft > 0) {
        await page.waitForSelector('#result', { timeout: 1000 })
          .then(() => {
            retryTimesLeft = 0;
          })
          .catch((error) => {
            retryTimesLeft--;
            if (retryTimesLeft === 0) {
              throw new Error('Timeout to get the result');
            }
          });
        if (util.hasError) {
          testResult = getErrorResult(task);
          util.hasError = false;
          throw new Error(util.errorMsg);
        }
      }
      testResult = await page.$eval('#result', (el) => el.textContent);
    } catch (error) {
      console.log(error);
      testResult = getErrorResult(task);
    }

    // handle errorMsg
    if (task === 'conformance') {
      results[results.length - 1][(epIndex + 1) * resultMetricsLength] =
        errorMsg;
    }
    errorMsg = '';

    // pause if needed
    if ('pause-task' in util.args) {
      const readlineInterface = readline.createInterface(
        { input: process.stdin, output: process.stdout });
      await new Promise((resolve) => {
        readlineInterface.question('Press Enter to continue...\n', resolve);
      });
    }

    // handle error
    if (util.hasError) {
      testResult = getErrorResult(task);
      util.hasError = false;
    }

    // handle result
    let metricIndex = 0;
    let testResults = JSON.parse(testResult);
    while (metricIndex < metricsLength) {
      results[results.length - 1][epIndex * resultMetricsLength + metricIndex + 1] =
        testResults[util.taskMetrics[task][metricIndex]];
      metricIndex += 1;
    }

    util.log(result);

    try {
      if (!('disable-new-browser' in util.args)) {
        await closeBrowser(browser);
      }
    } catch (error) {
    }

    if ('enable-trace' in util.args) {
      await parseTrace(traceFile);
    }
  }

  try {
    if ('disable-new-browser' in util.args) {
      await closeBrowser(browser);
    }
  } catch (error) {
  }

  if (task === 'performance') {
    let file =
      path.join(util.timestampDir, `${util.timestamp.substring(0, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify(results));
    util.upload(file, '/workspace/project/work/ort/perf');
  }

  return Promise.resolve(results);
}

module.exports = runBenchmark;
