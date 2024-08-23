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
      'document.querySelector("#model-progress").innerText.startsWith("Model download finished")'
    );
    const button = await page.$('#send-button');
    button.click();
    const status = await page.waitForSelector('#status', (e) => e.textContent);
    console.log(status);
    const result = status.match('execution time: (.*)ms')[1];
    return result;
  }
}

module.exports = OrtSdturboWebgpu;
