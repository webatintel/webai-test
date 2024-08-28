'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class JsGeminiWebgpu extends App {
  metric = 'TPS'
  name = 'js-gemini-webgpu';
  timeout = 1200000;
  url = 'https://webatintel.github.io/webai-demos/js-gemini-webgpu';
  //url = 'https://wp-27.sh.intel.com/workspace/project/webatintel/webai-demos/js-gemini-webgpu/';

  async getResult(page) {
    await util.sleep(10000)
    await page.waitForFunction(
      'document.querySelector("#tps").textContent.includes("tokens")'
    );
    const tpsElement = page.awaitForSelector('#tps');
    const result = tpsElement.textContent.replace('tokens/s', '');
    return result;
  }
}

module.exports = JsGeminiWebgpu;
