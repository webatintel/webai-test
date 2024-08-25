// TODO
'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TjsPhiWebgpu extends App {
  metric = 'TPS'
  name = 'tjs-phi3.5-webgpu';
  url = 'https://webatintel.github.io/webai-demos/tjs-phi35-webgpu/';

  async getResult(page) {
    const buttonElement = await page.waitForSelector('button');
    buttonElement.click();

    await page.waitForSelector(".text-xl");
    console.log('ready')
    const textareaElement = page.waitForSelector('textarea');
    console.log(textareaElement.textContent)
    textareaElement.textContent = this.defaultLlmInput;

    console.log(2)
    const sendButtonElement = await page.waitForSelector('div > div > div');
    sendButtonElement.click();

    const result = await page.$eval('#root > div > div.overflow-y-auto.scrollbar-thin.w-full.flex.flex-col.items-center.h-full > p > span.font-medium.text-center.mr-1.text-black.dark\:text-white', (el) => el.textContent);
    return result;
  }
}

module.exports = TjsPhiWebgpu;
