'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TjsWebgpuMobilenet extends App {
  metric = 'FPS'
  name = 'tjs-webgpu-mobilenet';
  url = 'https://huggingface.co/spaces/Xenova/webgpu-mobilenet';

  async getResult(page) {
    const iframe = await util.getIframe(page, 'iframe');
    await iframe.waitForSelector('#status');
    let status = await iframe.$eval('#status', (e) => e.textContent);
    while (!status.startsWith('FPS')) {
      await util.sleep(1000);
      status = await iframe.$eval('#status', (e) => e.textContent);
    }

    const results = [];
    for (let i = 0; i < 3; i++) {
      const status = await iframe.$eval('#status', (e) => e.textContent);
      results.push(parseFloat(status.replace('FPS: ', '')));
      await util.sleep(1000);
    }
    return util.average(results);
  }
}

module.exports = TjsWebgpuMobilenet;
