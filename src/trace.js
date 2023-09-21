const fs = require('fs');
const util = require('./util');

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
  let cpuBase, cpuFreq, gpuBase, gpuFreq, timeShift;
  const chromeEventNames = [
    'DeviceBase::APICreateComputePipeline',
    'CreateComputePipelineAsyncTask::Run',
    'DeviceBase::APICreateShaderModule',
    'Queue::Submit',
  ];

  for (let result of results) {
    let modelName = result[0];

    for (let ep of util.allEps) {
      let traceFile = `${modelName}-${ep}-trace.json`;
      let timelineJson = [];
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
          if (message === 'TFJS::predictStart') {
            timelineJson.push({ 'CPU-TFJS': [], 'CPU-CHROME': [], 'GPU': [] });
          }

          if (message.startsWith('TFJS::GPU::')) {
            for (let item of JSON.parse(message.replace('TFJS::GPU::', ''))) {
              let query = item['query'];
              timelineJson[timelineJson.length - 1]['GPU'].push([
                item['name'], getMs('GPU', query[0]), getMs('GPU', query[1])
              ]);
            }
          } else if (message.startsWith('TFJS::')) {
            if (timeShift === 0) {
              timeShift = -getMs('CPU', event['ts']);
            }
            timelineJson[timelineJson.length - 1]['CPU-TFJS'].push(
              [message, getMs('CPU', event['ts'])]);
          }
        } else if (chromeEventNames.indexOf(eventName) >= 0) {
          let prefix = '';
          if (event['args']['label']) {
            prefix = `${event['args']['label']}::`
          }
          let startTime = getMs('CPU', event['ts']);
          let endTime =
            parseFloat((startTime + event['dur'] / 1000).toFixed(2));
          timelineJson[timelineJson.length - 1]['CPU-CHROME'].push(
            [`${prefix}${eventName}`, startTime, endTime]);
        }
      }

      timelineJsonFile = traceFile.replace('-trace', '');
      if (fs.existsSync(timelineJsonFile)) {
        fs.truncateSync(timelineJsonFile, 0);
      }
      fs.writeFileSync(timelineJsonFile, JSON.stringify(timelineJson));
    }
  }

  function getMs(type, tick) {
    if (type === 'CPU') {
      return parseFloat(
        ((tick - cpuBase * 1000000 / cpuFreq) / 1000 + timeShift).toFixed(2));
    } else {
      return parseFloat(
        ((tick - gpuBase) * 1000 / gpuFreq + timeShift).toFixed(2));
    }
  }
}

module.exports = parseTrace;
