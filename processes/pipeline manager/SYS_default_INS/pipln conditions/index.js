// pipln conditions — Pipeline Condition Process
// Used as a task inside a pipeline.
//
// taskPrams.prams must contain:
//   condition  : fn() → returns a CBK key (string)
//   selections : { [cbkKey]: { name, pipln? } }
//     - name  : name to register the new pipeline under in PipelineManager
//     - pipln : (optional) the actual pipeline array; if provided it is registered first
//
// Behaviour:
//   1. Calls condition() → gets a CBK key
//   2. Looks up that key in selections
//   3. Optionally registers the new pipeline in PipelineManager
//   4. Signals pipln exe to switch to that pipeline (previous pipeline is paused/despawned)

async function conditionIns(taskPrams) {
  if (!taskPrams || !taskPrams.taskData) return;

  const { condition, selections } = taskPrams.prams;

  if (typeof condition !== "function") {
    throw new Error("[pipln cond] prams.condition must be a function");
  }
  if (!selections || typeof selections !== "object") {
    throw new Error("[pipln cond] prams.selections must be a hashmap (object)");
  }

  const selectedKey = await condition();
  const selected = selections[selectedKey];

  if (!selected) {
    throw new Error(
      `[pipln cond] condition() returned "${selectedKey}" which is not in selections`,
    );
  }

  // Optionally register the pipeline if provided inline
  if (selected.pipln && selected.name && taskPrams.main_pipln) {
    taskPrams.main_pipln.addPipeline(selected.name, selected.pipln);
  }

  // Signal pipln exe to switch — it will stop the current pipeline after this task
  taskPrams._switchSignal = { name: selected.name };
}

function create(ctx) {
  return {
    cbk: "piplnCond",
    id: `piplnCond_${Date.now()}`,
    // When used as a task directly
    task: conditionIns,
    // Ins Manager protocol
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

module.exports = { create, conditionIns };
