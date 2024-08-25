'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TjsMobilenetWebgpu extends App {
  metric = 'FPS'
  name = 'tjs-mobilenet-webgpu';
  url = 'https://huggingface.co/spaces/Xenova/webgpu-mobilenet';

  async getResult(page) {
    const iframe = await util.getIframe(page, 'iframe');
    await iframe.waitForSelector('#status');
    let status = await iframe.$eval('#status', (el) => el.textContent);
    while (!status.startsWith('FPS')) {
      await util.sleep(1000);
      status = await iframe.$eval('#status', (el) => el.textContent);
    }

    const results = [];
    for (let i = 0; i < 3; i++) {
      const status = await iframe.$eval('#status', (el) => el.textContent);
      results.push(parseFloat(status.replace('FPS: ', '')));
      await util.sleep(1000);
    }
    return util.average(results);
  }
}

module.exports = TjsMobilenetWebgpu;
