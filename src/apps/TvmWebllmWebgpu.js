'use strict';

const { App } = require('../app.js');
const util = require('../util.js');

class TvmWebllmWebgpu extends App {
  metric = 'TPS';
  name = 'tvm-webllm-webgpu';
  timeout = 3600000;
  url = 'https://chat.webllm.ai/';

  chatSelector = 'body > div.home_container__4PEJZ.home_container__4PEJZ > div.home_sidebar__fPZfq.false > div.home_sidebar-body__9zbei > div > div > div.home_chat-item-delete__3qV5m'
  modelSelectSelector = '#app-body > div > div.chat_chat-input-panel__rO72m > div.chat_chat-input-actions__mwYC_ > div.chat_chat-input-action__DMW7Y.clickable.chat_full-width__RdaYc';
  modelSelector = '#app-body > div > div.chat_chat-input-panel__rO72m > div.chat_chat-input-actions__mwYC_ > div.ui-lib_selector__tdy57 > div > div';
  modelInfo = {
    'llama3.1_8b': 'Llama-3.1-8B-Instruct-q4f16_1-MLC-1k',
    'phi3.5_mini': 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k',
    'smollm_1.7b': 'SmolLM-1.7B-Instruct-q4f16_1-MLC',
    'smollm_360m': 'SmolLM-360M-Instruct-q4f16_1-MLC',
    'qwen2_0.5b': 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    'qwen2_7b': 'Qwen2-7B-Instruct-q4f16_1-MLC',
    'qwen2_math_1.5b': 'Qwen2-Math-1.5B-Instruct-q4f16_1-MLC',
    'qwen2_math_7b': 'Qwen2-Math-7B-Instruct-q4f16_1-MLC',
    'gemma2_2b': 'gemma-2-2b-it-q4f16_1-MLC-1k',
    'gemma2_9b': 'gemma-2-9b-it-q4f16_1-MLC',
    'llama3_8b': 'Llama-3-8B-Instruct-q4f16_1-MLC-1k',
    'phi3_mini': 'Phi-3-mini-4k-instruct-q4f16_1-MLC-1k',
  };

  constructor(appInfo) {
    super();
    this.modelName = appInfo[1];
  }

  async getResult(page) {
    // Clean up existing chat
    const chatElement = await page.waitForSelector(this.chatSelector);
    chatElement.click();

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
    await util.sleep(1000);
    page.evaluate((selector, modelInfo, modelName) => {
      const count = document.querySelector(selector).children.length;
      for (let i = 1; i <= count; i++) {
        const childSelector = `${selector} >div:nth-child(${i})`;
        const childNameSelector = `${childSelector} > div > div > div`;
        if (modelInfo[modelName] === document.querySelector(childNameSelector).textContent) {
          document.querySelector(childSelector).click();
          break;
        }
      }
    }, this.modelSelector, this.modelInfo, this.modelName);

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

module.exports = TvmWebllmWebgpu;
