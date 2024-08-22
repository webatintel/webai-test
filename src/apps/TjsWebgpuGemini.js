'use strict';

const Benchmark = require('./benchmark.js');

class TjsWebgpuMobilenet extends Benchmark {
  metric = 'fps'
  name = 'tjs-webgpu-mobilenet';
  url = 'https://huggingface.co/spaces/Xenova/webgpu-mobilenet';

  async getResult(page) {
    console.log(1);
    await page.waitForSelector('#status');
    console.log(2);
    const result = await page.$('#status', (el) => el.textContent);
    return result;
  }
}

module.exports = TjsWebgpuMobilenet;
