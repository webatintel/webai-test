'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let browserArgs = ['--enable-features=SharedArrayBuffer', '--start-maximized'];
// webgpu
browserArgs.push(
  ...['--enable-webgpu-developer-features',
    '--enable-dawn-features=use_dxc,disable_robustness']);
// webnn
browserArgs.push(
  ...['--enable-features=WebMachineLearningNeuralNetwork',
    '--disable-gpu-sandbox']);

let parameters = ['modelName', 'ep'];

let platform = os.platform();

let allEps = ['webgpu', 'wasm', 'webnn-gpu', 'webnn-cpu'];

// please make sure these metrics are shown up in order
let taskMetrics = {
  conformance: ['result'],
  performance: ['first', 'average', 'best'],
};

const outDir = path.join(path.resolve(__dirname), '../out');
ensureDir(outDir);

const server = 'wp@wp-27.sh.intel.com';

const sshKey = path.join(os.homedir(), '.ssh/id_rsa_common');
const remoteCmdArgs = fs.existsSync(sshKey) ? `-i ${sshKey}` : '';

async function asyncFunctionWithTimeout(asyncPromise, timeout) {
  let timeoutHandle;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Async function timeout limit reached')),
      timeout);
  });

  return Promise.race([asyncPromise, timeoutPromise]).then(result => {
    clearTimeout(timeoutHandle);
    return result;
  })
}

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function uncapitalize(s) {
  return s[0].toLowerCase() + s.slice(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function ensureNoDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureNoFile(file) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

function getDuration(start, end) {
  let diff = Math.abs(start - end);
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
}

function getFloat(value) {
  return Math.round(parseFloat(value) * 100) / 100;
}

function getTimestamp(format) {
  const date = new Date();
  let timestamp = date.getFullYear() + padZero(date.getMonth() + 1) +
    padZero(date.getDate());
  if (format === 'second') {
    timestamp += padZero(date.getHours()) + padZero(date.getMinutes()) +
      padZero(date.getSeconds());
  }
  return timestamp;
}

function log(info) {
  console.log(info);
  fs.appendFileSync(this.logFile, String(info) + '\n');
}

function padZero(str) {
  return ('0' + str).slice(-2);
}

function scp(src, dest) {
  return `scp ${remoteCmdArgs} ${src} ${dest}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ssh(cmd) {
  return `ssh ${remoteCmdArgs} ${server} ${cmd}`;
}

module.exports = {
  allEps: allEps,
  conformanceEps: [],
  breakdown: false,
  browserArgs: browserArgs,
  hostname: os.hostname(),
  server: server,
  outDir: outDir,
  parameters: parameters,
  performanceEps: [],
  platform: platform,
  taskMetrics: taskMetrics,
  timeout: 90 * 1000,
  toolkitUrl: '',
  toolkitUrlArgs: ['modelUrl=server'],
  unitEps: [],
  updateModelNames: [],

  asyncFunctionWithTimeout: asyncFunctionWithTimeout,
  capitalize: capitalize,
  ensureDir: ensureDir,
  ensureNoDir: ensureNoDir,
  ensureNoFile: ensureNoFile,
  getDuration: getDuration,
  getFloat: getFloat,
  getTimestamp: getTimestamp,
  log: log,
  scp: scp,
  sleep: sleep,
  ssh: ssh,
  uncapitalize: uncapitalize,
};
