'use strict';

const Benchmark = require('./benchmark.js');

class TjsGeminiWebgpu extends Benchmark {
  metric = 'fps'
  name = 'tjs-gemini-webgpu';
  timeout = 1200000;
  url = 'https://huggingface.co/spaces/Xenova/webgpu-mobilenet';

  async getResult(page) {
    console.log(1);
    await page.waitForSelector('#status');
    console.log(2);
    const result = await page.$('#status', (e) => e.textContent);
    return result;
  }
}

module.exports = TjsGeminiWebgpu;
