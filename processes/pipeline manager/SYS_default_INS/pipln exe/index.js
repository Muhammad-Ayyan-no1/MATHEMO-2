// pipln exe :: Pipeline Executor
// Runs a single pipeline (array of task objects).
//
// Each task object in the pipeline MUST be a hashmap with:
//   { id, cbk, task: fn(taskPrams, index, pipeline), prams: {} }
//
// taskPrams is a shared mutable context passed along the entire pipeline.
// It holds: { main_pipln (PipelineManager ins), piplnVar, taskData, prams, cbk, logger, dbg }

import { ERROR_MESSAGES } from "../../../constants/index.js";

async function runPipeline(pipeline, taskPrams) {
  if (!Array.isArray(pipeline)) {
    throw new Error(ERROR_MESSAGES.PIPELINE_NOT_ARRAY);
  }
  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i];
    if (!step || typeof step.task !== "function") continue;
    // injects self
    taskPrams.prams = step.prams || {};
    taskPrams.taskData = step;

    const result = await step.task(taskPrams, i, pipeline);

    // when a new pipeline is requested, the current one is paused OR deleted (deleted only when there is no new task)
    if (taskPrams._switchSignal) {
      const { name } = taskPrams._switchSignal;
      delete taskPrams._switchSignal;
      if (taskPrams.main_pipln && taskPrams.main_pipln.switchPipeline) {
        await taskPrams.main_pipln.switchPipeline(name, taskPrams);
      }
      return;
    }
    if (result !== undefined && taskPrams.piplnVar && step.cbk) {
      taskPrams.piplnVar.set(step.cbk, result);
    }
  }
}

function create(ctx) {
  return {
    cbk: "piplnExe",
    id: `piplnExe_${Date.now()}`,
    run: runPipeline,
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create, runPipeline };
