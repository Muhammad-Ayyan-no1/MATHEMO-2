import * as insManagerModule from "./processes/Ins Manager/index.js";
import * as piplnMgrModule from "./processes/pipeline manager/index.js";
import * as cbkModule from "./processes/Code Base Keywords/index.js";
import * as loggerModule from "./processes/auto logger/index.js";
import * as dbgModule from "./processes/debugger/index.js";
import * as cliModule from "./processes/Auto Command Line Interface/index.js";
import * as libModule from "./processes/automatic polly and library/index.js";

async function bootstrap() {
  const insManager = insManagerModule.create({});
  insManager.init();

  const cbk = await insManager.spawn(cbkModule, {});
  const library = await insManager.spawn(libModule, {});
  await library.ins.preload();

  const logger = await insManager.spawn(loggerModule, {
    active: true,
    prefix: "<Template fillout>",
    lib: library.ins,
  });

  const dbg = await insManager.spawn(dbgModule, {
    active: false,
    logger: logger.ins,
    lib: library.ins,
  });

  const cli = await insManager.spawn(cliModule, {
    active: true,
    lib: library.ins,
  });

  const piplnMgr = await insManager.spawn(piplnMgrModule, {
    pipelines: {
      // "hello-world": [
      //   {
      //     id: "greet",
      //     cbk: "greet",
      //     task: async (taskPrams) => {
      //       taskPrams.logger.info(
      //         "greet",
      //         "Hello, World! This is a test pipeline.",
      //       );
      //       return "Pipeline executed successfully";
      //     },
      //     prams: {},
      //   },
      // ],
    },
  });

  logger.success("insM", "System bootstrap complete");

  const taskPrams = {
    main_pipln: piplnMgr.ins,
    piplnVar: null,
    taskData: null,
    prams: {},
    logger: logger.ins,
    dbg: dbg.ins,
    cli: cli.ins,
    cbk: cbk.ins,
    lib: library.ins,
  };

  // await piplnMgr.switchPipeline("hello-world", taskPrams);

  return {
    insManager,
    piplnMgr,
    cbk,
    logger,
    dbg,
    cli,
    library,
    taskPrams,
  };
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});

export { bootstrap };
