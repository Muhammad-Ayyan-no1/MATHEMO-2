const pipelines = {};
const pipelineHistory = [];

function addpipeline(name, pipeline) {
  if (pipeline[name]) return;
  pipelineHistory.push({
    type: "add",
    prams: {
      name: name,
      data: pipeline,
    },
  });
  pipelines[name] = pipeline;
}

function removePipeline(name) {
  pipelineHistory.push({
    type: "del",
    prams: {
      name: name,
      data: pipelines[name],
    },
  });
  delete pipelines[name];
}

function updatePipeline(name, pipeline) {
  if (!pipeline[name]) {
    addpipeline(name, pipeline);
    return;
  }
  pipelineHistory.push({
    type: "update",
    prams: {
      name: name,
      oldData: pipelines[name],
      data: pipeline,
    },
  });
  pipelines[name] = pipeline;
}

function getPipeline(name) {
  pipelineHistory.push({
    type: "read",
    prams: {
      name: name,
      data: pipelines[name],
    },
  });
  return pipelines[name];
}

// it injects the instance of "Pipelne Manager" into the new pipline ins and gives it control
function switchPipln(name) {}

function create() {
  return {
    cbk: "Pipe_Line_Manager",
  };
}

module.exports = {
  create,
};
