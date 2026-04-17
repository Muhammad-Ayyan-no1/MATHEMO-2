// pipln mgr :: Pipeline Manager
// Default system process
// Bootstrap: registers pipelines lazily (only created when required)
// Pipelines are frozen in time until executed (except async/bg ops)
// Exposes its own instance into each taskPrams as main_pipln

import { runPipeline } from "./SYS_default_INS/pipln exe/index.js";
import { create as piplnVarProcess } from "./SYS_default_INS/pipln var/index.js";
import { ERROR_MESSAGES } from "../constants/index.js";

const pipelines = {};
const pipelineHistory = [];

function addPipeline(name, pipeline) {
  if (pipelines[name]) return;
  pipelineHistory.push({ op: "add", name, data: pipeline, ts: Date.now() });
  pipelines[name] = pipeline;
}

function removePipeline(name) {
  if (!pipelines[name]) return;
  pipelineHistory.push({
    op: "del",
    name,
    data: pipelines[name],
    ts: Date.now(),
  });
  delete pipelines[name];
}

function updatePipeline(name, pipeline) {
  if (!pipelines[name]) {
    addPipeline(name, pipeline);
    return;
  }
  pipelineHistory.push({
    op: "update",
    name,
    oldData: pipelines[name],
    data: pipeline,
    ts: Date.now(),
  });
  pipelines[name] = pipeline;
}

function getPipeline(name) {
  pipelineHistory.push({
    op: "read",
    name,
    data: pipelines[name],
    ts: Date.now(),
  });
  return pipelines[name];
}

// Injects this PipelineManager instance and a fresh piplnVar into context.
async function switchPipeline(name, inheritedTaskPrams) {
  const pipeline = pipelines[name];
  if (!pipeline) {
    throw new Error(ERROR_MESSAGES.PIPELINE_NOT_FOUND.replace("{name}", name));
  }

  const taskPrams = inheritedTaskPrams || {
    main_pipln: selfRef, //inject-ing thing
    piplnVar: null,
    taskData: null,
    prams: {},
    logger: null,
    dbg: null,
  };

  if (!taskPrams.piplnVar) {
    taskPrams.piplnVar = piplnVarProcess({}).ins;
  }

  taskPrams.main_pipln = selfRef;

  await runPipeline(pipeline, taskPrams);
  return taskPrams;
}

const selfRef = {
  cbk: "piplnMgr",
  addPipeline,
  removePipeline,
  updatePipeline,
  getPipeline,
  switchPipeline: async (name, tPrams) => switchPipeline(name, tPrams),
  history: () => [...pipelineHistory],
  list: () => Object.keys(pipelines),
};

function create(ctx) {
  if (ctx && ctx.pipelines) {
    for (const name in ctx.pipelines) addPipeline(name, ctx.pipelines[name]);
  }

  return {
    cbk: "piplnMgr",
    id: `piplnMgr_${Date.now()}`,
    ins: selfRef,
    addPipeline,
    removePipeline,
    updatePipeline,
    getPipeline,
    switchPipeline: async (name, tPrams) => switchPipeline(name, tPrams),
    list: () => Object.keys(pipelines),
    history: () => [...pipelineHistory],
    init() {},
    despawn() {
      for (const k in pipelines) delete pipelines[k];
    },
    exportState() {
      return { pipelines: { ...pipelines }, history: [...pipelineHistory] };
    },
    importState(state) {
      if (state && state.pipelines) {
        for (const k in state.pipelines) addPipeline(k, state.pipelines[k]);
      }
    },
  };
}

export { create };
