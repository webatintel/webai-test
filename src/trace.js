const fs = require("fs");
const util = require("./util");

let cpuBase, cpuFreq, gpuBase, gpuFreq, baseTime, timelineStack, timelineJson;
let cpuInferenceIndex = -1;
let cpuKernelIndex;
let gpuInferenceIndex = 0;
let gpuKernelIndex = -1;
let kernelGroups = [];
const smallDuration = 0.001;

function parseTrace(traceFile) {
  let timestamp;
  if ("timestamp" in util.args) {
    timestamp = util.args["timestamp"];
  } else {
    timestamp = util.timestamp;
  }
  let traceDir = `${util.outDir}/${timestamp}`;
  process.chdir(traceDir);

  if (traceFile === undefined) {
    traceFile = `${traceDir}/${util.args["trace-file"]}.json`;
  }

  const chromeEventNames = [
    "DeviceBase::APICreateComputePipeline",
    "CreateComputePipelineAsyncTask::Run",
    "DeviceBase::APICreateComputePipelineAsync",
    "DeviceBase::APICreateShaderModule",
    "Queue::Submit",
  ];

  timelineJson = { "CPU::ORT": [], "GPU::ORT": [], "CPU::CHROME": [] };
  timelineStack = { "CPU::ORT": [], "GPU::ORT": [], "CPU::CHROME": [] };
  baseTime = 0;

  let traceJson = JSON.parse(fs.readFileSync(traceFile));
  for (let event of traceJson["traceEvents"]) {
    let eventName = event["name"];
    if (eventName != "d3d12::CommandRecordingContext::ExecuteCommandList Detailed Timing") {
      continue;
    }
    let splitRawTime = event["args"]["Timing"].split(",");
    cpuBase = splitRawTime[2].split(":")[1];
    gpuBase = splitRawTime[3].split(":")[1];
    cpuFreq = splitRawTime[4].split(":")[1];
    gpuFreq = splitRawTime[5].split(":")[1];
    break;
  }

  for (let event of traceJson["traceEvents"]) {
    let eventName = event["name"];

    if (eventName === "TimeStamp") {
      let message = event["args"]["data"]["message"];
      if (message.startsWith("CPU::ORT")) {
        if (baseTime === 0) {
          baseTime = getMs("CPU", event["ts"]);
        }
        handleMessage(message, getMs("CPU", event["ts"]));
      }
    } else if (chromeEventNames.indexOf(eventName) >= 0) {
      let prefix = "";
      if (event["args"]["label"]) {
        prefix = `${event["args"]["label"]}::`;
      }
      let startTime = getMs("CPU", event["ts"]);
      let duration = getFloat(event["dur"] / 1000);
      timelineJson["CPU::CHROME"].push({
        name: `${prefix}${eventName}`,
        start: startTime,
        duration: duration,
      });
    }
  }

  //console.log(kernelGroups);
  for (let event of traceJson["traceEvents"]) {
    let eventName = event["name"];
    if (eventName === "TimeStamp") {
      let message = event["args"]["data"]["message"];
      if (message.startsWith("GPU::ORT")) {
        const info = message.replace("GPU::ORT::", "").split("::");
        if (gpuKernelIndex === kernelGroups[0]) {
          kernelGroups.shift();
          gpuKernelIndex = -1;
          gpuInferenceIndex++;
        }
        gpuKernelIndex++;
        const name = `${info[0]}::${gpuInferenceIndex}::${gpuKernelIndex}`;
        let startTime = getMs("GPU", info[1]);
        const endTime = getMs("GPU", info[2]);
        let duration = getFloat(endTime - startTime);
        if (duration === 0) {
          duration = smallDuration;
          startTime -= smallDuration;
        }
        timelineJson["GPU::ORT"].push({ name: name, start: startTime, duration: duration });
      }
    }
  }

  const timelineJsonFile = traceFile.replace("-trace", "");
  if (fs.existsSync(timelineJsonFile)) {
    fs.truncateSync(timelineJsonFile, 0);
  }
  fs.writeFileSync(timelineJsonFile, JSON.stringify(timelineJson));
}

function getFloat(value) {
  return Math.round(parseFloat(value) * 100) / 100;
}

function getMs(type, tick) {
  if (type === "CPU") {
    return getFloat((tick - (cpuBase * 1000000) / cpuFreq) / 1000 - baseTime);
  } else {
    return getFloat(((tick - gpuBase) * 1000) / gpuFreq - baseTime);
  }
}

function handleMessage(message, timeline) {
  if (message.startsWith("CPU::ORT")) {
    if (message.startsWith("CPU::ORT::FUNC_BEGIN")) {
      let funcName = message.split(" ")[0].replace("CPU::ORT::FUNC_BEGIN::", "");
      if (funcName.startsWith("WebGpuBackend.run")) {
        kernelGroups[kernelGroups.length - 1] += 1;
        cpuKernelIndex++;
      } else if (funcName.startsWith("_InferenceSession.run")) {
        kernelGroups.push(-1);
        cpuKernelIndex = -1;
        cpuInferenceIndex++;
      }

      if (
        funcName.startsWith("WebGpuBackend.run") ||
        funcName.startsWith("ProgramManager.build") ||
        funcName.startsWith("ProgramManager.run")
      ) {
        funcName += `::${cpuInferenceIndex}::${cpuKernelIndex}`;
      }
      const child = { name: funcName, start: timeline, duration: smallDuration };
      if (timelineStack["CPU::ORT"].length > 0) {
        const top = timelineStack["CPU::ORT"][timelineStack["CPU::ORT"].length - 1];
        if (!("children" in top)) {
          top["children"] = [];
        }
        top["children"].push(child);
      }
      timelineStack["CPU::ORT"].push(child);
    } else if (message.startsWith("CPU::ORT::FUNC_END")) {
      const child = timelineStack["CPU::ORT"].pop();
      child["duration"] = getFloat(timeline - child["start"]);
      if (timelineStack["CPU::ORT"].length === 0) {
        if (!("CPU::ORT" in timelineJson)) {
          timelineJson["CPU::ORT"] = [];
        }
        timelineJson["CPU::ORT"].push(child);
      }
    }
  }
}

module.exports = parseTrace;
