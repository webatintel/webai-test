'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let parameters = [
  'modelName',
  'ep',
];

let platform = os.platform();

let allEps = ['webgpu', 'wasm', 'webnn'];

// please make sure these metrics are shown up in order
let taskMetrics = {
  'conformance': ['result'],
  'performance': ['first', 'average', 'best']
};

const outDir = path.join(path.resolve(__dirname), '../out');
ensureDir(outDir);

const server = 'wp@wp-27.sh.intel.com';

const sshKey = path.join(os.homedir(), '.ssh/id_rsa_common');
const remoteCmdArgs = fs.existsSync(sshKey) ? `-i ${sshKey}` : '';

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

function log(info) {
  console.log(info);
  fs.appendFileSync(this.logFile, String(info) + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function scp(src, dest) {
  return `scp ${remoteCmdArgs} ${src} ${dest}`;
}

function ssh(cmd) {
  return `ssh ${remoteCmdArgs} ${server} ${cmd}`
}

module.exports = {
  allEps: allEps,
  conformanceEps: [],
  breakdown: false,
  browserArgs:
    '--enable-features=WebAssemblyThreads,SharedArrayBuffer,WebAssemblySimd,MediaFoundationD3D11VideoCapture --start-maximized --enable-dawn-features=allow_unsafe_apis,use_dxc --enable-webgpu-developer-features --enable-features=MachineLearningNeuralNetworkService --enable-experimental-web-platform-features',
  hostname: os.hostname(),
  server: server,
  outDir: outDir,
  parameters: parameters,
  performanceEps: [],
  platform: platform,
  taskMetrics: taskMetrics,
  timeout: 60 * 1000,
  toolkitUrl: '',
  toolkitUrlArgs: '',
  unitEps: [],
  updateModelNames: [],

  capitalize: capitalize,
  ensureDir: ensureDir,
  ensureNoDir: ensureNoDir,
  ensureNoFile: ensureNoFile,
  getDuration: getDuration,
  log: log,
  sleep: sleep,
  uncapitalize: uncapitalize,
  scp: scp,
  ssh: ssh,
};
