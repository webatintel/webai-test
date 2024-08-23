'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TvmWebllmWebgpu extends App {
  metric = 'tokens/sec';
  name = 'tvm-webgpu-webllm';
  timeout = 3600000;
  url = 'https://chat.webllm.ai/';

  modelSelectSelector = '#app-body > div > div.chat_chat-input-panel__rO72m > div.chat_chat-input-actions__mwYC_ > div.chat_chat-input-action__DMW7Y.clickable.chat_full-width__RdaYc';
  modelSelector = '#app-body > div > div.chat_chat-input-panel__rO72m > div.chat_chat-input-actions__mwYC_ > div.ui-lib_selector__tdy57 > div > div > div:nth-child(1)';
  modelSelectorMap = {
    'llama31': 2,
    'phi3': 10,
  };

  constructor(appInfo) {
    super();
    this.modelName = appInfo[1];
  }

  async getResult(page) {
    // Popup the model selector
    await page.waitForSelector(this.modelSelectSelector);
    await util.sleep(1000);
    // Use page.evaluate as I could not make it work with page.waitForSelector() using the same selector
    page.evaluate((selector) => {
      const modelSelectElement = document.querySelector(selector);
      modelSelectElement.click();
    }, this.modelSelectSelector);

    // Choose the model
    await page.waitForSelector(this.modelSelector);
    page.evaluate((selector, modelSelectorMap, modelName) => {
      const modelSelector = selector.replace('nth-child(1)', `nth-child(${modelSelectorMap[modelName]})`);
      const modelElement = document.querySelector(modelSelector);
      modelElement.click();
    }, this.modelSelector, this.modelSelectorMap, this.modelName);

    // Feed input
    const input = await page.waitForSelector('#chat-input');
    input.type('Tell me a story in 10 words');
    // Sleep a while so that Enter takes effect
    await util.sleep(1000);
    // Could not trigger button.click()
    await page.keyboard.press('Enter');

    // Get the existing count of messages
    await util.sleep(1000);
    let existingCount = await page.evaluate(() => {
      return document.querySelectorAll('#app-body > div > div.chat_chat-body__QFv5x > div').length;
    });
    //console.log(existingCount);

    // Get result
    const resultSelector = `#app-body > div > div.chat_chat-body__QFv5x > div:nth-child(${existingCount}) > div > div.chat_chat-message-action-date__RsXTn > div:nth-child(2)`;
    const resultElement = await page.waitForSelector(resultSelector, { timeout: this.timeout });
    let result = await page.$eval(resultSelector, (e) => e.textContent);
    result = result.match('Decode: (\\d+\\.\\d+) tok/s,')[1];
    return result;
  }
}

module.exports = TvmWebgpuWebllm;
