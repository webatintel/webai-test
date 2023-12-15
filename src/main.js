'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const si = require('systeminformation');
const yargs = require('yargs');

const runBenchmark = require('./benchmark.js');
const config = require('./config.js');
const report = require('./report.js');
const parseTrace = require('./trace.js');
const upload = require('./upload.js');
const util = require('./util.js');

util.args =
  yargs.usage('node $0 [args]')
    .strict()
    .option('model-name', {
      type: 'string',
      describe: 'model name to run, split by comma',
    })
    .option('benchmark-json', {
      type: 'string',
      describe: 'benchmark json',
      default: 'benchmark.json',
    })
    .option('browser', {
      type: 'string',
      describe:
        'browser specific path, can be chrome_canary, chrome_dev, chrome_beta or chrome_stable',
      default: 'chrome_canary',
    })
    .option('browser-args', {
      type: 'string',
      describe: 'extra browser args',
    })
    .option('cleanup-user-data-dir', {
      type: 'boolean',
      describe: 'cleanup user data dir',
    })
    .option('conformance-ep', {
      type: 'string',
      describe: 'ep for conformance, split by comma',
    })
    .option('dev-mode', {
      type: 'boolean',
      describe: 'dev mode, and ort-toolkit url is different',
    })
    .option('disable-breakdown', {
      type: 'boolean',
      describe: 'disable breakdown',
    })
    .option('dryrun', {
      type: 'boolean',
      describe: 'dryrun the test',
    })
    .option('email', {
      alias: 'e',
      type: 'string',
      describe: 'email to',
    })
    .option('kill-chrome', {
      type: 'boolean',
      describe: 'kill chrome before testing',
    })
    .option('disable-new-context', {
      type: 'boolean',
      describe: 'start a new context for each test',
    })
    .option('pause-test', {
      type: 'boolean',
      describe: 'pause after each performance test',
    })
    .option('performance-ep', {
      type: 'string',
      describe: 'ep for performance, split by comma',
    })
    .option('repeat', {
      type: 'number',
      describe: 'repeat times',
      default: 1,
    })
    .option('run-times', {
      type: 'number',
      describe: 'run times',
    })
    .option('server-info', {
      type: 'boolean',
      describe: 'get server info and display it in report',
    })
    .option('skip-config', {
      type: 'boolean',
      describe: 'skip config',
    })
    .option('tasks', {
      type: 'string',
      describe:
        'test tasks, split by comma, can be conformance, performance, trace, upload and so on.',
      default: 'conformance,performance',
    })
    .option('ort-url', {
      type: 'string',
      describe: 'ort url',
    })
    .option('timestamp', {
      type: 'string',
      describe: 'timestamp format, day or second',
      default: 'second',
    })
    .option('toolkit-url', {
      type: 'string',
      describe: 'toolkit url to test against',
    })
    .option('toolkit-url-args', {
      type: 'string',
      describe: 'extra toolkit url args',
    })
    .option('enable-trace', {
      type: 'boolean',
      describe: 'enable trace',
    })
    .option('trace-timestamp', {
      type: 'string',
      describe: 'trace timestamp',
    })
    .option('upload', {
      type: 'boolean',
      describe: 'upload result to server',
    })
    .option('warmup-times', {
      type: 'number',
      describe: 'warmup times',
    })
    .example([
      ['node $0 --email a@intel.com;b@intel.com // Send report to emails'],
      [
        'node $0 --tasks performance --toolkit-url http://127.0.0.1/workspace/project/onnxruntime'
      ],
      [
        'node $0 --tasks performance --model-name pose-detection --architecture BlazePose-heavy --input-size 256 --input-type tensor --performance-ep webgpu'
      ],
      [
        'node $0 --browser-args="--enable-dawn-features=disable_workgroup_init --no-sandbox --enable-zero-copy"'
      ],
      [
        'node $0 --tasks performance --model-name mobilenetv2-12 --performance-ep webgpu --warmup-times 0 --run-times 1 --server-info --disable-new-context'
      ],
      [
        'node $0 --tasks performance --model-name mobilenetv2-12 --performance-ep webgpu --warmup-times 0 --run-times 1 --timestamp day'
      ],
      ['node $0 --enable-trace --trace-timestamp 20220601'],
      [
        'node $0 --tasks conformance --conformance-ep webgpu --model-name mobilenetv2-12 --timestamp day --skip-config // single test'
      ],
      [
        'node $0 --tasks performance --performance-ep webgpu --model-name mobilenetv2-12 --timestamp day --skip-config // single test'
      ],
      ['node $0 --tasks conformance --timestamp day --benchmark-json benchmark-wip.json --dev-mode'],
      [
        'node $0 --tasks performance --performance-ep webgpu --model-name mobilenetv2-12 --enable-trace --ort-url gh/20231215 -trace--timestamp day'
      ],
    ])
    .help()
    .wrap(180)
    .argv;

function padZero(str) {
  return ('0' + str).slice(-2);
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

async function main() {
  if ('kill-chrome' in util.args) {
    spawnSync('cmd', ['/c', 'taskkill /F /IM chrome.exe /T']);
  }

  let browserPath;
  let userDataDir;
  if (util.args['browser'] === 'chrome_canary') {
    util['chromePath'] = 'Chrome SxS';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
      userDataDir = `/Users/${os.userInfo()
        .username}/Library/Application Support/Google/Chrome Canary`;
    } else if (util.platform === 'linux') {
      // There is no Canary channel for Linux, use dev channel instead
      browserPath = '/usr/bin/google-chrome-unstable';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${util['chromePath']}/User Data`;
    }
  } else if (util.args['browser'] === 'chrome_dev') {
    util['chromePath'] = 'Chrome Dev';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev';
      userDataDir = `/Users/${os.userInfo()
        .username}/Library/Application Support/Google/Chrome Dev`;
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-unstable';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Dev/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${util['chromePath']}/User Data`;
    }
  } else if (util.args['browser'] === 'chrome_beta') {
    util['chromePath'] = 'Chrome Beta';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta';
      userDataDir = `/Users/${os.userInfo()
        .username}/Library/Application Support/Google/Chrome Beta`;
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-beta';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-beta`;
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Beta/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${util['chromePath']}/User Data`;
    }
  } else if (util.args['browser'] === 'chrome_stable') {
    util['chromePath'] = 'Chrome';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/Chrome`;
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-stable';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-stable`;
    } else if (util.platform === 'win32') {
      browserPath =
        `${process.env.PROGRAMFILES}/Google/Chrome/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${util['chromePath']}/User Data`;
    }
  } else {
    browserPath = util.args['browser'];
    userDataDir = `${util.outDir}/user-data-dir`;
  }

  util.browserPath = browserPath;
  util.userDataDir = userDataDir;
  if ('cleanup-user-data-dir' in util.args) {
    console.log('Cleanup user data dir');
    util.ensureNoDir(userDataDir);
  }

  if (util.platform === 'linux') {
    util.browserArgs.push(...[
      '--enable-unsafe-webgpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
    ]);
  }
  if (util.platform === 'darwin') {
    util.browserArgs.push('--use-mock-keychain');
  }
  if ('browser-args' in util.args) {
    util.browserArgs.push(...util.args['browser-args'].split(' '));
  }

  if ('enable-trace' in util.args) {
    util.toolkitUrlArgs.push('enableTrace=true');
    util.browserArgs.push(...[
      '--enable-unsafe-webgpu',
      '--enable-dawn-features=allow_unsafe_apis,use_dxc,record_detailed_timing_in_trace_events,disable_timestamp_query_conversion',
      '--trace-startup-format=json',
      '--enable-tracing=disabled-by-default-gpu.dawn',
    ]);
  }

  util.toolkitUrl = 'https://wp-27.sh.intel.com/workspace/project/';
  if ('dev-mode' in util.args) {
    util.toolkitUrl += 'webatintel/';
  }
  util.toolkitUrl += 'ort-toolkit'

  if ('toolkit-url-args' in util.args) {
    util.toolkitUrlArgs.push(...util.args['toolkit-url-args'].split('&'));
  }

  if ('dryrun' in util.args) {
    util.dryrun = true;
  } else {
    util.dryrun = false;
  }

  if ('toolkit-url' in util.args) {
    util.toolkitUrl = util.args['toolkit-url'];
  }

  let tasks = util.args['tasks'].split(',');

  if (!fs.existsSync(util.outDir)) {
    fs.mkdirSync(util.outDir, { recursive: true });
  }

  if (!util.args['skip-config']) {
    await config();
  }

  const cpuData = await si.cpu();
  util.cpuThreads = Number(cpuData.physicalCores) / 2;

  util.upload = function (file, serverFolder) {
    if (!('upload' in util.args)) {
      return;
    }
    serverFolder = `${serverFolder}/${util.platform}/${util['gpuDeviceId']}`;
    let result = spawnSync(util.ssh(`ls ${serverFolder}`), { shell: true });
    if (result.status != 0) {
      spawnSync(util.ssh(`mkdir -p ${serverFolder}`), { shell: true });
    }

    result = spawnSync(util.scp(file, `${util.server}:${serverFolder}`), { shell: true });
    if (result.status !== 0) {
      util.log('[ERROR] Failed to upload file');
    } else {
      util.log(`[INFO] File was successfully uploaded to ${serverFolder}`);
    }
  }

  let results = {};
  util.duration = '';
  let startTime;

  for (let task of tasks) {
    if (['conformance', 'performance'].indexOf(task) >= 0) {
      console.log(`Use browser at ${util.browserPath}`);
      console.log(`Use user-data-dir at ${util.userDataDir}`);
      break;
    }
  }

  for (let i = 0; i < util.args['repeat']; i++) {
    // ensure logFile
    if ('trace-timestamp' in util.args) {
      util.timestamp = util.args['trace-timestamp'];
    } else {
      util.timestamp = getTimestamp(util.args['timestamp']);
    }
    util.timestampDir = path.join(util.outDir, util.timestamp);
    util.ensureDir(util.timestampDir);
    util.logFile = path.join(util.timestampDir, `${util.timestamp}.log`);
    if (fs.existsSync(util.logFile)) {
      fs.truncateSync(util.logFile, 0);
    }

    if (util.args['repeat'] > 1) {
      util.log(`== Test round ${i + 1}/${util.args['repeat']} ==`);
    }
    for (let task of tasks) {
      startTime = new Date();
      util.log(`=${task}=`);
      if (['conformance', 'performance'].indexOf(task) >= 0) {
        if (!(task === 'performance' && util.warmupTimes === 0 &&
          util.runTimes === 0)) {
          results[task] = await runBenchmark(task);
        }
      } else if (task === 'trace') {
        await parseTrace();
      }
      util.duration += `${task}: ${(new Date() - startTime) / 1000} `;
    }

    if (!('trace-timestamp' in util.args)) {
      await report(results);
    }
  }
  if ('upload' in util.args) {
    await upload();
  }
}

main();
