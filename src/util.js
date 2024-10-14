'use strict';

const fs = require('fs');
const nodemailer = require("nodemailer");
const os = require('os');
const path = require('path');

let browserArgs = ['--enable-features=SharedArrayBuffer', '--start-maximized', '--auto-accept-camera-and-microphone-capture'];
// webgpu
browserArgs.push(
  ...['--enable-webgpu-developer-features']);
// webnn
browserArgs.push(
  ...['--enable-features=WebMachineLearningNeuralNetwork',
    '--disable-gpu-sandbox', '--use-redist-dml']);

let parameters = ['modelName', 'ep'];

let platform = os.platform();

let allEps = ['webgpu', 'wasm', 'webnn-gpu'];

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

const average = array => getFloat(array.reduce((a, b) => a + b) / array.length, 2);

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

async function getIframe(page, selector) {
  const iframeElement = await page.waitForSelector(selector);
  return await iframeElement.contentFrame();
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

function intersect(a, b) {
  if (!Array.isArray(a)) {
    a = [a];
  }
  if (!Array.isArray(b)) {
    b = [b];
  }
  return a.filter((v) => b.includes(v));
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

async function sendMail(to, subject, html) {
  let from = "webgraphics@intel.com";

  let transporter = nodemailer.createTransport({
    host: "ecsmtp.pdx.intel.com",
    port: 25,
    secure: false,
    auth: false,
  });

  transporter.verify((error) => {
    if (error) console.log("transporter error: ", error);
    else console.log("Email was sent!");
  });

  let info = await transporter.sendMail({
    from: from,
    to: to,
    subject: subject,
    html: html,
  });
  return Promise.resolve();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ssh(cmd) {
  return `ssh ${remoteCmdArgs} ${server} ${cmd}`;
}

function stdoutOnData(data) {
  console.log(`${data}`);
}

function stderrorOnData(data) {
  console.log(`${data}`);
}

function onClose(code) {
  console.log(`process exited with code ${code}`);
}

module.exports = {
  average: average,
  allEps: allEps,
  conformanceEps: [],
  cpuCount: os.cpus().length,
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
  toolkitUrlArgs: [],
  unitEps: [],
  updateModelNames: [],

  asyncFunctionWithTimeout: asyncFunctionWithTimeout,
  capitalize: capitalize,
  ensureDir: ensureDir,
  ensureNoDir: ensureNoDir,
  ensureNoFile: ensureNoFile,
  getDuration: getDuration,
  getFloat: getFloat,
  getIframe: getIframe,
  getTimestamp: getTimestamp,
  intersect: intersect,
  log: log,
  scp: scp,
  sendMail: sendMail,
  sleep: sleep,
  stdoutOnData: stdoutOnData,
  stderrorOnData: stderrorOnData,
  onClose: onClose,
  ssh: ssh,
  uncapitalize: uncapitalize,
};
