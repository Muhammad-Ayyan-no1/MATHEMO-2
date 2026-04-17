// pipln conditions  Pipeline Condition Process
// Used as a task inside a pipeline.
//
// taskPrams.prams must contain:
//   condition  : fn() => returns a CBK key (string)
//   selections : { [cbkKey]: { name, pipln? } }
//     - name  : name to register the new pipeline under in PipelineManager
//     - pipln : (optional) the actual pipeline array; if provided it is registered first
//
// Behaviour:
//   1. Calls condition() => gets a CBK key
//   2. Looks up that key in selections
//   3. Optionally registers the new pipeline in PipelineManager
//   4. Signals pipln exe to switch to that pipeline (previous pipeline is paused/despawned)

import { ERROR_MESSAGES } from "../../../constants/index.js";

async function conditionIns(taskPrams) {
  if (!taskPrams || !taskPrams.taskData) return;

  const { condition, selections } = taskPrams.prams;

  if (typeof condition !== "function") {
    throw new Error(ERROR_MESSAGES.CONDITION_NOT_FUNCTION);
  }
  if (!selections || typeof selections !== "object") {
    throw new Error(ERROR_MESSAGES.CONDITION_SELECTIONS_NOT_OBJECT);
  }

  const selectedKey = await condition();
  const selected = selections[selectedKey];

  if (!selected) {
    throw new Error(
      ERROR_MESSAGES.CONDITION_KEY_NOT_IN_SELECTIONS.replace(
        "{key}",
        selectedKey,
      ),
    );
  }

  if (selected.pipln && selected.name && taskPrams.main_pipln) {
    taskPrams.main_pipln.addPipeline(selected.name, selected.pipln);
  }

  taskPrams._switchSignal = { name: selected.name };
}

function create(ctx) {
  return {
    cbk: "piplnCond",
    id: `piplnCond_${Date.now()}`,
    task: conditionIns,
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create, conditionIns };
