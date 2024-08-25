'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class OrtSdturboWebgpu extends App {
  metric = 'ms'
  name = 'ort-sdturbo-webgpu';
  timeout = 1200000;
  url = 'https://webatintel.github.io/webai-demos/ort-sdturbo-webgpu/';

  async getResult(page) {
    await page.waitForFunction(
      'document.querySelector("#model-progress").textContent.startsWith("Model download finished")'
    );
    const button = await page.$('#send-button');
    button.click();
    await page.waitForFunction(
      'document.querySelector("#status").textContent.includes("execution time")'
    );
    const status = await page.$eval('#status', (el) => el.textContent);
    const result = status.match('execution time: (.*)ms')[1];
    return result;
  }
}

module.exports = OrtSdturboWebgpu;
