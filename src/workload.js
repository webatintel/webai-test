"use strict";

const puppeteer = require("puppeteer");
const readline = require("readline");

const parseTrace = require("./trace.js");
const util = require("./util.js");

async function startBrowser(traceFile) {
  let extraBrowserArgs = [];
  extraBrowserArgs.push(`--trace-startup-file=${traceFile}`);

  let browser = await puppeteer.launch({
    args: util["browserArgs"].concat(extraBrowserArgs),
    defaultViewport: null,
    executablePath: util["browserPath"],
    headless: false,
    ignoreHTTPSErrors: true,
    userDataDir: util.userDataDir,
  });
  let page = await browser.newPage();
  return [browser, page];
}

async function workload() {
  let browser;
  let page;

  let traceFile = `${util.timestampDir}/workload-webgpu-trace.json`;
  [browser, page] = await startBrowser(traceFile);

  try {
    await page.goto(util.args['workload-url']);
    const retryTimes = util.args["workload-timeout"];
    let retryTimesLeft = retryTimes;
    while (retryTimesLeft > 0) {
      await page.waitForSelector("#ortStatus", { timeout: 1000 }).then(() => {
        retryTimesLeft = 0;
      }).catch((e) => {
        retryTimesLeft--;
        if (retryTimesLeft === 0) {
          throw new Error("Timeout is hit");
        }
      });
    }
  } catch (error) {
  }

  // pause if needed
  if ("pause-task" in util.args) {
    const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise((resolve) => {
      readlineInterface.question("Press Enter to continue...\n", resolve);
    });
  }

  await browser.close();
  await parseTrace(traceFile);
}

module.exports = workload;
