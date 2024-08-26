'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TjsPhiWebgpu extends App {
  metric = 'TPS'
  name = 'tjs-phi3.5-webgpu';
  // 'https://huggingface.co/spaces/webml-community/phi-3.5-webgpu'
  url = 'https://webatintel.github.io/webai-demos/tjs-phi35-webgpu/';

  async getResult(page) {
    // load model
    const buttonElement = await page.waitForSelector('button');
    buttonElement.click();

    // wait for ready
    await page.waitForSelector(".text-xl");

    // feed input
    await page.type('textarea', this.defaultLlmInput);
    await page.keyboard.press('Enter');

    // get result
    const resultSelector = 'div > div > p > span:nth-child(2)';
    await page.waitForSelector(resultSelector);
    await page.waitForFunction(
      `!document.querySelector("${resultSelector}").textContent.startsWith("tokens")`
    )
    const result = await page.$eval(resultSelector, (el) => el.textContent);
    return result;
  }
}

module.exports = TjsPhiWebgpu;
