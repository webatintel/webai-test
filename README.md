## Introduction

This is a test framework to fulfill high level tasks related to ONNX Runtime at the client side. Tasks include conformance test, performance test, workload test, and so on.

## Supported OS

- Windows
- Linux
- macOS

## Supported Browser

- Chrome

## Dependencies

- [Node.js](https://nodejs.org/en/)

## Usage

Please change the current working directory to src/ for commands starting with "node main.js".

### Preparation

- yarn

- node main.js // Use --help for more options

### Conformance Test

This is to compare the EP results with WASM results

- node main.js --tasks conformance

### Performance Test

This is to run predefined benchmarks and collect their perf data.

- node main.js --tasks performance

### Workload Test

This is to run any workload with a timeout

- node main.js --tasks workload --workload-url <workload_url> --workload-timeout <workload_timeout>

### Enable Trace

In theory, trace can be enabled for all the tasks. However, as it's attached to performance, trace is usually enabled together with performance test and workload test. For more technical details, please check the document [Profile WebGPU Apps](https://docs.google.com/document/d/1TuVxjE8jnELBXdhI4QGFgMnUqQn6Q53QA9y4a_dH688/edit).

- node main.js --tasks performance --enable-trace
- node main.js --tasks workload --workload-url <workload_url> --enable-trace

Example:

- Change your application

  - Point your web application to onnxruntime build with trace support, like `<script src="https://webatintel.github.io/ort-web/20231227-trace/ort.webgpu.js" crossorigin="anonymous"> </script>`
  - Enable trace with env at the beginning of your code, i.e., "ort.env.trace = true;"

- Clone this repo with "git clone https://github.com/webatintel/ort-test"
- cd ort-test/src, run "node main.js --timestamp-format day --tasks workload --workload-url <workload_url> --enable-trace"
- start a local web server, like "python -mhttp.server"
- visit "http://localhost:8000/ort-test/src/timeline?file=[date]/workload-webgpu"
