'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const readline = require('readline');

const util = require('./util.js');

async function runApp() {
  let apps = [];
  let appJson = path.join(path.resolve(__dirname), util.args['app-json']);
  let taskConfigs = JSON.parse(fs.readFileSync(appJson));

  for (let appName of taskConfigs) {
    let config = {};
    if ('app-name' in util.args) {
      config['appName'] =
        util.intersect(appName, util.args['app-name'].split(','));
    } else {
      config['appName'] = appName;
    }
    if (config['appName'].length === 0) {
      continue;
    }

    apps.push(appName);
  }

  const results = [];

  for (let i = 0; i < apps.length; i++) {
    const appInfo = apps[i].split('-');
    const appName = appInfo[0];
    util.log(`[${i + 1}/${apps.length}] ${apps[i]}`);
    const OneApp = require(`./apps/${appName}.js`);
    const app = new OneApp(appInfo);
    const result = await app.run();
    results.push([apps[i], result, app.metric]);
  }
  return results;
}

class App {
  defaultLlmInput = 'Tell me a story in 10 words';
  metric;
  name;
  timeout = 3600000;
  url;
  async startBrowser(timeout) {
    let extraBrowserArgs = [];
    let browser = await puppeteer.launch({
      args: util['browserArgs'].concat(extraBrowserArgs),
      defaultViewport: null,
      executablePath: util['browserPath'],
      headless: false,
      ignoreHTTPSErrors: true,
      userDataDir: util.userDataDir,
      protocolTimeout: timeout,
    });
    let page = await browser.newPage();
    return [browser, page];
  }

  async closeBrowser(browser) {
    // browser.close hangs on some machines, and process.kill also has chance to
    // fail to start browser.

    try {
      util.asyncFunctionWithTimeout(await browser.close(), 10);
      //console.log('Close the browser with browser.close');
    } catch (error) {
      console.log('Close the browser with process.kill');
      const pid = browser.process().pid;
      process.kill(pid);
    }
  }

  getResult(page) {
    throw new Error('Not implemented');
  }

  async run() {
    let browser;
    let page;

    [browser, page] = await this.startBrowser(this.timeout);
    if (this.timeout) {
      page.setDefaultTimeout(this.timeout);
    }

    await page.goto(this.url);
    const result = await this.getResult(page);

    // pause if needed
    if ('task-pause' in util.args) {
      const readlineInterface = readline.createInterface(
        { input: process.stdin, output: process.stdout });
      await new Promise((resolve) => {
        readlineInterface.question('Press Enter to continue...\n', resolve);
      });
    }

    // handle result
    util.log(result);
    await this.closeBrowser(browser);

    /*
      let file =
        path.join(util.timestampDir, `${util.timestamp.substring(0, 8)}.json`);
      fs.writeFileSync(file, JSON.stringify(results));
      util.upload(file, '/workspace/project/work/ort/perf');
    */

    return result;
  }
}

module.exports = { runApp, App };
