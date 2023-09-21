'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yargs = require('yargs');

const runBenchmark = require('./benchmark.js');
const config = require('./config.js');
const report = require('./report.js');
const parseTrace = require('./trace.js');
const runUnit = require('./unit.js');
const upload = require('./upload.js');
const util = require('./util.js');

util.args =
  yargs.usage('node $0 [args]')
    .strict()
    .option('model', {
      type: 'string',
      describe: 'model to run, split by comma',
    })
    .option('benchmark-json', {
      type: 'string',
      describe: 'benchmark json',
      default: 'benchmark.json',
    })
    .option('toolkit-url', {
      type: 'string',
      describe: 'toolkit url to test against',
    })
    .option('toolkit-url-args', {
      type: 'string',
      describe: 'extra toolkit url args',
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
    .option('new-context', {
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
    .option('target', {
      type: 'string',
      describe:
        'test target, split by comma, can be conformance, performance, unit, trace, upload and so on.',
      default: 'conformance,performance',
    })
    .option('ort-dir', {
      type: 'string',
      describe: 'ort dir',
    })
    .option('timestamp', {
      type: 'string',
      describe: 'timestamp format, day or second',
      default: 'second',
    })
    .option('trace', {
      type: 'boolean',
      describe: 'trace',
    })
    .option('trace-timestamp', {
      type: 'string',
      describe: 'trace timestamp',
    })
    .option('unit-ep', {
      type: 'string',
      describe: 'ep for unit, split by comma',
    })
    .option('unit-filter', {
      type: 'string',
      describe: 'filter for unit test',
    })
    .option('unit-skip-build', {
      type: 'boolean',
      describe: 'skip build for unit test',
    })
    .option('upload', {
      type: 'boolean',
      describe: 'upload result to server',
    })
    .option('use-dxc', {
      type: 'boolean',
      describe: 'use dxc instead of fxc',
    })
    .option('warmup-times', {
      type: 'number',
      describe: 'warmup times',
    })
    .example([
      ['node $0 --email a@intel.com;b@intel.com // Send report to emails'],
      [
        'node $0 --target performance --toolkit-url http://127.0.0.1/workspace/project/tfjswebgpu/tfjs'
      ],
      [
        'node $0 --target performance --model pose-detection --architecture BlazePose-heavy --input-size 256 --input-type tensor --performance-ep webgpu'
      ],
      [
        'node $0 --browser-args="--enable-dawn-features=disable_workgroup_init --no-sandbox --enable-zero-copy"'
      ],
      [
        'node $0 --target performance --model mobilenetv2-12 --performance-ep webgpu --warmup-times 0 --run-times 1 --server-info --new-context'
      ],
      [
        'node $0 --target performance --model mobilenetv2-12 --performance-ep webgpu --warmup-times 0 --run-times 1 --timestamp day'
      ],
      [
        'node $0 --target performance --model mobilenetv2-12 --performance-ep webgpu --warmup-times 0 --run-times 3 --timestamp day --trace'
      ],
      ['node $0 --target trace --trace-timestamp 20220601'],
      ['node $0 --target unit --unit-filter=add --unit-skip-build'],
      [
        'node $0 --target conformance --conformance-ep webgpu --model mobilenetv2-12 --timestamp day --skip-config // single test'
      ],
      [
        'node $0 --target performance --performance-ep webgpu --model mobilenetv2-12 --timestamp day --skip-config // single test'
      ],
      ['node $0 --target unit --unit-ep webgpu --timestamp day'],
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
  console.log(`Use browser at ${browserPath}`);
  util.userDataDir = userDataDir;
  console.log(`Use user-data-dir at ${userDataDir}`);
  if ('cleanup-user-data-dir' in util.args) {
    console.log('Cleanup user data dir');
    util.ensureNoDir(userDataDir);
  }

  if (util.platform === 'linux') {
    util.browserArgs +=
      ' --enable-unsafe-webgpu --use-angle=vulkan --enable-features=Vulkan';
  }
  if (util.platform === 'darwin') {
    util.browserArgs += ' --use-mock-keychain';
  }
  if ('browser-args' in util.args) {
    util.browserArgs = `${util.browserArgs} ${util.args['browser-args']}`;
  }
  if ('use-dxc' in util.args) {
    util.browserArgs += ' --enable-dawn-features=use_dxc';
  }
  if ('trace' in util.args) {
    util.breakdown = false;
    util.args['new-context'] = true;
    util.toolkitUrlArgs += '&trace=true';
    util.browserArgs +=
      ' --enable-dawn-features=record_detailed_timing_in_trace_events,disable_timestamp_query_conversion --trace-startup-format=json --enable-tracing=disabled-by-default-gpu.dawn'
  }

  let warmupTimes;
  if ('warmup-times' in util.args) {
    warmupTimes = parseInt(util.args['warmup-times']);
  } else {
    warmupTimes = 10;
  }
  util.warmupTimes = warmupTimes;

  let runTimes;
  if ('run-times' in util.args) {
    runTimes = parseInt(util.args['run-times']);
  } else {
    runTimes = 10;
  }
  util.runTimes = runTimes;

  if ('disable-breakdown' in util.args) {
    util.breakdown = false;
  }

  util.toolkitUrlArgs += `ortUrl=https://wp-27.sh.intel.com/workspace/project/onnxruntime&warmupTimes=${warmupTimes}&runTimes=${runTimes}`;

  if ('toolkit-url-args' in util.args) {
    util.toolkitUrlArgs += `&${util.args['toolkit-url-args']}`;
  }

  if ('dryrun' in util.args) {
    util.dryrun = true;
  } else {
    util.dryrun = false;
  }

  if ('toolkit-url' in util.args) {
    util.toolkitUrl = util.args['toolkit-url'];
  }

  let targets = util.args['target'].split(',');

  if (!fs.existsSync(util.outDir)) {
    fs.mkdirSync(util.outDir, { recursive: true });
  }

  if (!util.args['skip-config']) {
    await config();
  }

  let results = {};
  util.duration = '';
  let startTime;
  for (let i = 0; i < util.args['repeat']; i++) {
    if (!('trace-timestamp' in util.args)) {
      util.timestamp = getTimestamp(util.args['timestamp']);
      util.timestampDir = path.join(util.outDir, util.timestamp);
      util.ensureDir(util.timestampDir);
      util.logFile = path.join(util.timestampDir, `${util.timestamp}.log`);
      if (fs.existsSync(util.logFile)) {
        fs.truncateSync(util.logFile, 0);
      }

      // trial
      let trialJson = path.join(path.resolve(__dirname), 'trial.json');
      let trials = JSON.parse(fs.readFileSync(trialJson));
      let dateInt = parseInt(util.timestamp.substring(0, 8));

      for (let trial of trials['browserArgs']) {
        if (dateInt >= trial[1] && dateInt <= trial[2]) {
          console.log(`Trial "${trial[0]}" was added into browserArgs`);
          util.browserArgs += ` ${trial[0]}`;
        }
      }
    }

    if (util.args['repeat'] > 1) {
      util.log(`== Test round ${i + 1}/${util.args['repeat']} ==`);
    }

    for (let target of targets) {
      startTime = new Date();
      util.log(`=${target}=`);
      if (['conformance', 'performance'].indexOf(target) >= 0) {
        if (!(target === 'performance' && util.warmupTimes === 0 &&
          util.runTimes === 0)) {
          results[target] = await runBenchmark(target);
        }
      } else if (target === 'unit') {
        results[target] = await runUnit();
      } else if (target === 'trace') {
        await parseTrace();
      }
      util.duration += `${target}: ${(new Date() - startTime) / 1000} `;
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
