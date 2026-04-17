// pipln exe — Pipeline Executor
// Runs a single pipeline (array of task objects).
//
// Each task object in the pipeline MUST be a hashmap with:
//   { id, cbk, task: fn(taskPrams, index, pipeline), prams: {} }
//
// taskPrams is a shared mutable context passed along the entire pipeline.
// It holds: { main_pipln (PipelineManager ins), piplnVar, taskData, prams, cbk, logger, dbg }

async function runPipeline(pipeline, taskPrams) {
  if (!Array.isArray(pipeline)) {
    throw new Error("[pipln exe] pipeline must be an array of task objects");
  }
  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i];
    if (!step || typeof step.task !== "function") continue;

    // Inject step's own prams into shared taskPrams
    taskPrams.prams = step.prams || {};
    taskPrams.taskData = step;

    const result = await step.task(taskPrams, i, pipeline);

    // If a task signals a pipeline switch, honour it and stop current pipeline
    if (taskPrams._switchSignal) {
      const { name } = taskPrams._switchSignal;
      delete taskPrams._switchSignal;
      if (taskPrams.main_pipln && taskPrams.main_pipln.switchPipeline) {
        await taskPrams.main_pipln.switchPipeline(name, taskPrams);
      }
      return; // current pipeline ends here
    }

    // Store task result in piplnVar under its cbk key if result is defined
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
    // Ins Manager protocol
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create, runPipeline };
