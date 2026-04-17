function conditionIns(taskPrams) {
  if (!taskPrams.taskData) return;
  let piplnN = taskPrams.prams.condition();
  let piplnD = taskPrams.prams.selections[piplnN];
  if (piplnD.pipln && piplnD.name)
    taskPrams.main_pipln.ins.addPipline(piplnD.name, piplnD.pipln);

  taskPrams.main_pipln.ins.switchPipeline(piplnD.name);
}

function create() {}

module.exports = { create };
