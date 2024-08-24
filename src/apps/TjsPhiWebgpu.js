'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TjsPhiWebgpu extends App {
  metric = 'TPS'
  name = 'tjs-phi3.5-webgpu';
  url = 'https://huggingface.co/spaces/webml-community/phi-3.5-webgpu';

  async getResult(page) {
    const iframe = await util.getIframe(page, 'iframe');
    await iframe.waitForSelector('#status');
    const buttonElement = await iframe.waitForSelector('#root > div > div.h-full.overflow-auto.scrollbar-thin.flex.justify-center.items-center.flex-col.relative > div.flex.flex-col.items-center.px-4 > button')
    buttonElement.click();


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

module.exports = TjsMobilenetWebgpu;
