"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const readline = require("readline");

const parseTrace = require("./trace.js");
const util = require("./util.js");

let errorMsg = "";
const errorMsgMaxLength = 200;

function cartesianProduct(arr) {
  return arr.reduce(
    function (a, b) {
      return a
        .map(function (x) {
          return b.map(function (y) {
            return x.concat([y]);
          });
        })
        .reduce(function (a, b) {
          return a.concat(b);
        }, []);
    },
    [[]]
  );
}

function intersect(a, b) {
  if (!Array.isArray(a)) {
    a = [a];
  }
  if (!Array.isArray(b)) {
    b = [b];
  }
  return a.filter((v) => b.includes(v));
}

async function startContext(traceFile = undefined) {
  let extraBrowserArgs = [];
  if ("enable-trace" in util.args) {
    extraBrowserArgs.push(`--trace-startup-file=${traceFile}`);
  }

  if (!util.dryrun) {
    let context = await puppeteer.launch({
      args: util["browserArgs"].concat(extraBrowserArgs),
      defaultViewport: null,
      executablePath: util["browserPath"],
      headless: false,
      ignoreHTTPSErrors: true,
      userDataDir: util.userDataDir,
    });
    let page = await context.newPage();
    page.on("console", async (msg) => {
      for (let i = 0; i < msg.args().length; ++i) {
        const consoleError = `[console] ${i}: ${await msg.args()[i].jsonValue()}`;
        if (consoleError.search("Blocking on the main thread is very dangerous")) {
          continue;
        }
        util.log(consoleError);
        errorMsg += `${consoleError.substring(0, errorMsgMaxLength)}<br>`;
      }
    });
    page.on("pageerror", (error) => {
      const pageError = `[pageerror] ${error}`;

      // Temporarily skip some WebNN errors
      if (
        pageError.startsWith("[pageerror] Error: TypeError: Failed to execute 'fetch' on 'WorkerGlobalScope'") ||
        pageError.startsWith("[pageerror] Error: ErrorEvent") ||
        pageError.startsWith("[pageerror] Error: null")
      ) {
        return;
      }

      util.hasError = true;
      util.errorMsg = pageError;
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

function getErrorResult(task) {
  if (task === "conformance") {
    return '{"result":false}';
  } else if (task === "performance") {
    return '{"first":"NA","average":"NA","best":"NA"}';
  }
}

function removeSlowEps(eps) {
  if (util.gpuVendorId === "8086") {
    let configLen = eps.length;
    for (let i = configLen - 1; i >= 0; i--) {
      if (eps[i].startsWith("webnn")) {
        eps.splice(i, 1);
      }
    }
  }
}

async function runBenchmark(task) {
  // get benchmarks
  let benchmarks = [];
  let benchmarkJson = path.join(path.resolve(__dirname), util.args["benchmark-json"]);
  let taskConfigs = JSON.parse(fs.readFileSync(benchmarkJson));

  for (let modelName of taskConfigs) {
    let config = {};
    if ("model-name" in util.args) {
      config["modelName"] = intersect(modelName, util.args["model-name"].split(","));
    } else {
      config["modelName"] = modelName;
    }
    if (!config["modelName"]) {
      continue;
    }

    if (task === "conformance") {
      if ("conformance-ep" in util.args) {
        config["ep"] = util.args["conformance-ep"].split(",");
      } else {
        config["ep"] = structuredClone(util.allEps.filter((item) => ["wasm", "webgpu-fdo"].indexOf(item) < 0));
        //removeSlowEps(config['ep']);
      }
      for (let ep of config["ep"]) {
        if (util.conformanceEps.indexOf(ep) < 0) {
          util.conformanceEps.push(ep);
        }
      }
    } else if (task === "performance") {
      if ("performance-ep" in util.args) {
        config["ep"] = util.args["performance-ep"].split(",");
      } else {
        config["ep"] = structuredClone(util.allEps);
        //removeSlowEps(config['ep']);
      }
      for (let ep of config["ep"]) {
        if (util.performanceEps.indexOf(ep) < 0) {
          util.performanceEps.push(ep);
        }
      }
    }

    let seqArray = [];
    for (let p of util.parameters) {
      seqArray.push(p in config ? (Array.isArray(config[p]) ? config[p] : [config[p]]) : [""]);
    }
    benchmarks = benchmarks.concat(cartesianProduct(seqArray));
  }

  // run benchmarks
  let benchmarksLength = benchmarks.length;
  let previousModelName = "";

  // format: testName, (first, average, best) * (webgpu, wasm, webnn-gpu, webnn-cpu, webgpu-fdo)
  let results = [];
  let defaultValue = "NA";
  let epsLength = util.allEps.length;
  let metrics = util.taskMetrics[task];
  if (task === "performance" && util.runTimes === 0) {
    metrics.length = 1;
  }
  let metricsLength = metrics.length;
  // for errorMsg
  let resultMetricsLength = metricsLength;
  if (task === "conformance") {
    resultMetricsLength += 1;
  }
  let context;
  let page;

  if ("disable-new-context" in util.args) {
    [context, page] = await startContext();
  }

  for (let i = 0; i < benchmarksLength; i++) {
    let benchmark = benchmarks[i];
    let modelName = benchmark.slice(0, -1).join("-");
    let ep = benchmark[benchmark.length - 1];
    let epIndex = util.allEps.indexOf(ep);
    let testResult;

    util.log(`[${i + 1}/${benchmarksLength}] ${benchmark}`);

    if (!("disable-new-context" in util.args)) {
      let traceFile = undefined;
      if ("enable-trace" in util.args) {
        traceFile = `${util.timestampDir}/${benchmark.join("-").replace(/ /g, "_")}-trace.json`;
      }
      [context, page] = await startContext(traceFile);
    }

    // prepare result placeholder
    if (modelName != previousModelName) {
      let placeholder = [modelName].concat(Array(epsLength * resultMetricsLength).fill(defaultValue));
      if (task === "performance" && util.breakdown) {
        placeholder = placeholder.concat({});
      }
      results.push(placeholder);
      previousModelName = modelName;
    }
    let result = results[results.length - 1];

    if (util.dryrun) {
      let metricIndex = 0;
      while (metricIndex < metricsLength) {
        if (task === "conformance") {
          result[epIndex * resultMetricsLength + metricIndex + 1] = "true";
        } else if (task === "performance") {
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
      let url = `${util.toolkitUrl}?tasks=${task}`;

      for (let index = 0; index < util.parameters.length; index++) {
        if (benchmarks[i][index]) {
          if (util.parameters[index] === "ep" && benchmarks[i][index].startsWith("webnn")) {
            let deviceType = benchmarks[i][index].replace("webnn-", "");
            url += `&${util.parameters[index]}=webnn&deviceType=${deviceType}`;
            if (deviceType === "cpu") {
              url += `&webnnNumThreads=${util["cpuThreads"]}`;
            }
          } else if (util.parameters[index] === "ep" && benchmarks[i][index] === "webgpu-fdo") {
            url += `&${util.parameters[index]}=webgpu&enableFreeDimensionOverrides=true`;
          } else {
            url += `&${util.parameters[index]}=${benchmarks[i][index]}`;
          }
        }
      }
      if (util.toolkitUrlArgs) {
        url += `&${util.toolkitUrlArgs.join("&")}`;
      }
      if ("ort-url" in util.args) {
        url += `&ortUrl=${util.args["ort-url"]}`;
      } else {
        url += `&ortUrl=https://wp-27.sh.intel.com/workspace/project/onnxruntime`;
      }
      if (ep.startsWith("webnn")) {
        url += "-webnn";
      }
      // update model
      if (["whisper-tiny-decoder", "whisper-tiny-decoder-merged"].indexOf(modelName) >= 0) {
        url += "&updateModel=true";
      }

      if (task === "performance") {
        let warmupTimes;
        if ("warmup-times" in util.args) {
          warmupTimes = parseInt(util.args["warmup-times"]);
        } else {
          warmupTimes = 5;
        }
        util.warmupTimes = warmupTimes;

        let runTimes;
        if ("run-times" in util.args) {
          runTimes = parseInt(util.args["run-times"]);
        } else {
          runTimes = 5;
        }
        util.runTimes = runTimes;
        url += `&warmupTimes=${warmupTimes}&runTimes=${runTimes}`;
      }

      url += `&wasmThreads=${util["cpuThreads"]}`;

      if (util.updateModelNames.indexOf(modelName) >= 0) {
        url += "&updateModel=true";
      }

      console.log(url);

      try {
        await page.goto(url);
        if (!("crossOriginIsolated" in util)) {
          util["crossOriginIsolated"] = await page.evaluate(() => crossOriginIsolated);
        }

        const retryTimes = util.timeout / 1000;
        let retryTimesLeft = retryTimes;
        while (retryTimesLeft > 0) {
          await page
            .waitForSelector("#result", { timeout: 1000 })
            .then(() => {
              retryTimesLeft = 0;
            })
            .catch((e) => {
              retryTimesLeft--;
              if (retryTimesLeft === 0) {
                throw new Error("Timeout to get the result");
              }
            });
          if (util.hasError) {
            testResult = getErrorResult(task);
            util.hasError = false;
            throw new Error(util.errorMsg);
          }
        }
        testResult = await page.$eval("#result", (el) => el.textContent);
      } catch (error) {
        console.log(error);
        testResult = getErrorResult(task);
      }

      // handle errorMsg
      if (task === "conformance") {
        results[results.length - 1][(epIndex + 1) * resultMetricsLength] = errorMsg;
      }
      errorMsg = "";

      // pause if needed
      if ("pause-test" in util.args) {
        const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
        await new Promise((resolve) => {
          readlineInterface.question("Press Enter to continue...\n", resolve);
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
    }

    util.log(result);

    try {
      if (!("disable-new-context" in util.args)) {
        await closeContext(context);
      }
    } catch (error) { }
  }

  try {
    if ("disable-new-context" in util.args) {
      await closeContext(context);
    }
  } catch (error) { }

  if (task === "performance") {
    let file = path.join(util.timestampDir, `${util.timestamp.substring(0, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify(results));
    util.upload(file, "/workspace/project/work/ort/perf");
  }

  if ("enable-trace" in util.args) {
    await parseTrace();
  }

  return Promise.resolve(results);
}

module.exports = runBenchmark;
