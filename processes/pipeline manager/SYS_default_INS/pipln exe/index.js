var taskPram = [];

function runPipeLine(pipeline) {
  for (let i = 0; i < pipeline.length; i++) {
    if (!pipeline[i].task) continue;
    pipeline[i].task(taskPram, i, pipeline);
  }
}

function create() {}

module.exports = { create };
