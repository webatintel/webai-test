const fs = require('fs');
const util = require('./util');

let cpuBase, cpuFreq, gpuBase, gpuFreq, timeShift, timelineStack, timelineJson;

function parseTrace() {
  let traceTimestamp;
  if ('trace-timestamp' in util.args) {
    traceTimestamp = util.args['trace-timestamp'];
  } else {
    traceTimestamp = util.timestamp;
  }
  let traceDir = `${util.outDir}/${traceTimestamp}`;
  process.chdir(traceDir);

  let traceDate = traceTimestamp.substring(0, 8);
  let results = JSON.parse(fs.readFileSync(`${traceDir}/${traceDate}.json`));
  const chromeEventNames = [
    'DeviceBase::APICreateComputePipeline',
    'CreateComputePipelineAsyncTask::Run',
    'DeviceBase::APICreateComputePipeline',
    'DeviceBase::APICreateShaderModule',
    'Queue::Submit',
  ];

  for (let result of results) {
    let modelName = result[0];

    for (let ep of util.allEps) {
      let traceFile = `${modelName}-${ep}-trace.json`;
      timelineJson = { 'CPU::ORT': [], 'CPU::CHROME': [], 'GPU::ORT': [] };
      timelineStack = { 'CPU::ORT': [], 'CPU::CHROME': [], 'GPU::ORT': [] };
      timeShift = 0;
      if (!fs.existsSync(traceFile)) {
        continue;
      }

      let traceJson = JSON.parse(fs.readFileSync(traceFile));

      for (let event of traceJson['traceEvents']) {
        let eventName = event['name'];
        if (eventName !=
          'd3d12::CommandRecordingContext::ExecuteCommandList Detailed Timing') {
          continue;
        }
        let splitRawTime = event['args']['Timing'].split(',');
        cpuBase = splitRawTime[2].split(':')[1];
        gpuBase = splitRawTime[3].split(':')[1];
        cpuFreq = splitRawTime[4].split(':')[1];
        gpuFreq = splitRawTime[5].split(':')[1];
        break;
      }

      for (let event of traceJson['traceEvents']) {
        let eventName = event['name'];

        if (eventName === 'TimeStamp') {
          let message = event['args']['data']['message'];
          if (message.startsWith('GPU::ORT')) {
            for (let item of JSON.parse(message.replace('GPU::ORT::', ''))) {
              let query = item['query'];
              timelineJson['GPU::ORT'].push([
                item['name'], getMs('GPU', query[0]), getMs('GPU', query[1])
              ]);
            }
          } else if (message.startsWith('CPU::ORT')) {
            if (timeShift === 0) {
              timeShift = -getMs('CPU', event['ts']);
            }
            handleMessage(message, getMs('CPU', event['ts']));
          }
        } else if (chromeEventNames.indexOf(eventName) >= 0) {
          let prefix = '';
          if (event['args']['label']) {
            prefix = `${event['args']['label']}::`
          }
          let startTime = getMs('CPU', event['ts']);
          let endTime =
            parseFloat((startTime + event['dur'] / 1000).toFixed(2));
          timelineJson['CPU::CHROME'].push({ name: `${prefix}${eventName}`, start: startTime, duration: getFloatTime(endTime - startTime) });
        }
      }

      const timelineJsonFile = traceFile.replace('-trace', '');
      if (fs.existsSync(timelineJsonFile)) {
        fs.truncateSync(timelineJsonFile, 0);
      }
      fs.writeFileSync(timelineJsonFile, JSON.stringify(timelineJson));
    }
  }
}

function getFloatTime(time) {
  return parseFloat(time.toFixed(2));
}

function getMs(type, tick) {
  if (type === 'CPU') {
    return getFloatTime((tick - cpuBase * 1000000 / cpuFreq) / 1000 + timeShift);
  } else {
    return getFloatTime((tick - gpuBase) * 1000 / gpuFreq + timeShift);
  }
}

function handleMessage(message, timeline) {
  if (message.startsWith('CPU::ORT')) {
    if (message.startsWith('CPU::ORT::FUNC_BEGIN')) {
      const funcName = message.split(' ')[0].replace('CPU::ORT::FUNC_BEGIN::', '');
      const child = { name: funcName, start: timeline, duration: 0 };
      if (timelineStack['CPU::ORT'].length > 0) {
        const top = timelineStack['CPU::ORT'][timelineStack['CPU::ORT'].length - 1];
        if (!('children' in top)) {
          top['children'] = [];
        }
        top['children'].push(child);
      }
      timelineStack['CPU::ORT'].push(child);
    } else if (message.startsWith('CPU::ORT::FUNC_END')) {
      const funcName = message.split(' ')[0].replace('CPU::ORT::FUNC_END::', '');
      const child = timelineStack['CPU::ORT'].pop();
      child['duration'] = parseFloat((timeline - child['start']).toFixed(2));
      if (timelineStack['CPU::ORT'].length === 0) {
        if (!('CPU::ORT' in timelineJson)) {
          timelineJson['CPU::ORT'] = [];
        }
        timelineJson['CPU::ORT'].push(child);
      }
    }
  }
}

module.exports = parseTrace;
