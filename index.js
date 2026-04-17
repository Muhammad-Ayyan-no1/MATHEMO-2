// index.js — System Bootstrap
// Wires all system processes together following the Ins Manager protocol.
// Runs <Template fillout> pipeline on startup.

import * as insManagerModule from "./processes/Ins Manager/index.js";
import * as piplnMgrModule from "./processes/pipeline manager/index.js";
import * as cbkModule from "./processes/Code Base Keywords/index.js";
import * as loggerModule from "./processes/auto logger/index.js";
import * as dbgModule from "./processes/debugger/index.js";
import * as cliModule from "./processes/Auto Command Line Interface/index.js";

async function bootstrap() {
  // 1. Spawn Ins Manager (manages all other instances)
  const insManager = insManagerModule.create({});
  insManager.init();

  // 2. Spawn CBK (Code Base Keywords) — available globally
  const cbk = await insManager.spawn(cbkModule, {});

  // 3. Spawn Logger
  const logger = await insManager.spawn(loggerModule, {
    active: true,
    prefix: "<Template fillout>",
  });

  // 4. Spawn Debugger (deactivated by default; activate for dev)
  const dbg = await insManager.spawn(dbgModule, {
    active: false,
    logger: logger.ins,
  });

  // 5. Spawn CLI
  const cli = await insManager.spawn(cliModule, { active: true });

  // 6. Spawn Pipeline Manager with initial pipelines
  //    <Template fillout>: Register your pipelines here
  const piplnMgr = await insManager.spawn(piplnMgrModule, {
    pipelines: {
      "hello-world": [
        {
          id: "greet",
          cbk: "greet",
          task: async (taskPrams) => {
            // Use the injected logger to output a message
            taskPrams.logger.info(
              "greet",
              "Hello, World! This is a test pipeline.",
            );
            // Optionally, return a value to store in piplnVar
            return "Pipeline executed successfully";
          },
          prams: {}, // No extra params needed for this simple task
        },
      ],
    },
  });

  logger.success("insM", "System bootstrap complete");

  // 7. Build shared taskPrams (injected into every pipeline at runtime)
  const taskPrams = {
    main_pipln: piplnMgr.ins,
    piplnVar: null, // allocated fresh per pipeline run by piplnMgr
    taskData: null,
    prams: {},
    logger: logger.ins,
    dbg: dbg.ins,
    cli: cli.ins,
    cbk: cbk.ins,
  };

  // 8. <Template fillout>: Run your entry-point pipeline
  await piplnMgr.switchPipeline("hello-world", taskPrams);

  return {
    insManager,
    piplnMgr,
    cbk,
    logger,
    dbg,
    cli,
    taskPrams,
  };
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});

export { bootstrap };
