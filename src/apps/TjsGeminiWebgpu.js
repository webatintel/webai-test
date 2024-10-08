'use strict';

const Benchmark = require('./benchmark.js');

class TjsGeminiWebgpu extends App {
  metric = 'fps'
  name = 'tjs-gemini-webgpu';
  timeout = 1200000;
  url = 'https://huggingface.co/spaces/Xenova/webgpu-mobilenet';

  async getResult(page) {
    console.log(1);
    await page.waitForSelector('#status');
    console.log(2);
    const result = await page.$eval('#status', (el) => el.textContent);
    return result;
  }
}

module.exports = TjsGeminiWebgpu;
