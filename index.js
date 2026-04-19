import * as insManagerModule from "./processes/Ins Manager/index.js";
import * as piplnMgrModule from "./processes/pipeline manager/index.js";
import * as cbkModule from "./processes/Code Base Keywords/index.js";
import * as loggerModule from "./processes/auto logger/index.js";
import * as dbgModule from "./processes/debugger/index.js";
import * as cliModule from "./processes/Auto Command Line Interface/index.js";
import * as libModule from "./processes/automatic polly and library/index.js";
import * as tokenizerModule from "./processes/Tokenizer/index.js";
import * as parserModule from "./processes/Parser/index.js";
import * as astSemanticsModule from "./processes/AST_semantics/index.js";
import * as casModule from "./processes/Computerized Algebric System/index.js";
import * as optimizerModule from "./processes/Optimizer/index.js";
import * as codeGenModule from "./processes/CodeGen/index.js";
import * as interpreterModule from "./processes/inturpreter/index.js";
import * as piplnCondModule from "./processes/pipeline manager/SYS_default_INS/pipln conditions/index.js";

async function bootstrap() {
  const insManager = insManagerModule.create({});
  insManager.init();

  const cbk = await insManager.spawn(cbkModule, {});
  const library = await insManager.spawn(libModule, {});
  await library.ins.preload();

  const logger = await insManager.spawn(loggerModule, {
    active: true,
    prefix: "MaTHEmO v=P2",
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

  const tokenizer = await insManager.spawn(tokenizerModule, {});
  const parser = await insManager.spawn(parserModule, {
    lib: library.ins,
  });
  const astSemantics = await insManager.spawn(astSemanticsModule, {});
  const cas = await insManager.spawn(casModule, {
    lib: library.ins,
  });
  const optimizer = await insManager.spawn(optimizerModule, {});
  const codeGen = await insManager.spawn(codeGenModule, {});
  const interpreter = await insManager.spawn(interpreterModule, {});

  const piplnCond = await insManager.spawn(piplnCondModule, {});

  const createMainPipeline = (inputTask) => [
    {
      id: "input",
      cbk: "input",
      task: inputTask,
      prams: {},
    },
    {
      id: "tokenize",
      cbk: "tokenize",
      task: async (taskPrams) => {
        const input = taskPrams.piplnVar.get("input");
        return taskPrams.tokenizer.tokenize(input);
      },
      prams: {},
    },
    {
      id: "parse",
      cbk: "parse",
      task: async (taskPrams) => {
        const tokens = taskPrams.piplnVar.get("tokenize");
        return taskPrams.parser.parse(tokens);
      },
      prams: {},
    },
    {
      id: "astSemantics",
      cbk: "astSemantics",
      task: async (taskPrams) => {
        const ast = taskPrams.piplnVar.get("parse");
        return taskPrams.astSemantics.analyze(ast);
      },
      prams: {},
    },
    {
      id: "cas",
      cbk: "cas",
      task: async (taskPrams) => {
        const mathAst = taskPrams.piplnVar.get("astSemantics");
        return taskPrams.cas.formMathAst(mathAst);
      },
      prams: {},
    },
    {
      id: "optimize",
      cbk: "optimize",
      task: async (taskPrams) => {
        const optimizedAst = taskPrams.piplnVar.get("cas");
        return taskPrams.optimizer.optimize(optimizedAst);
      },
      prams: {},
    },
    {
      id: "chooseMode",
      cbk: "chooseMode",
      task: piplnCondModule.conditionIns,
      prams: {
        condition: async () => {
          const { mode } = await cli.ins.prompt([
            {
              type: "list",
              name: "mode",
              message: "Choose output mode:",
              choices: [
                { name: "Compile to code", value: "compile" },
                { name: "Interpret directly", value: "interpret" },
              ],
            },
          ]);
          return mode;
        },
        selections: {
          compile: { name: "compile-pipeline" },
          interpret: { name: "interpret-pipeline" },
        },
      },
    },
  ];

  const piplnMgr = await insManager.spawn(piplnMgrModule, {
    pipelines: {
      "MaTHEmO v=p2 by file": createMainPipeline(async (taskPrams) => {
        const fs = taskPrams.lib?.get?.("fs");
        if (!fs || typeof fs.readFileSync !== "function") {
          throw new Error("[input] fs module is unavailable");
        }
        const { filePath } = await taskPrams.cli.prompt([
          {
            type: "input",
            name: "filePath",
            message: "Enter a MATHEMO source file path:",
          },
        ]);
        return fs.readFileSync(filePath, "utf8");
      }),
      "MaTHEmO v=p2": createMainPipeline(async (taskPrams) => {
        const { input } = await taskPrams.cli.prompt([
          {
            type: "input",
            name: "input",
            message: "Enter the code string to process:",
          },
        ]);
        return input;
      }),
      "compile-pipeline": [
        {
          id: "codeGen",
          cbk: "codeGen",
          task: async (taskPrams) => {
            const finalAst = taskPrams.piplnVar.get("optimize");
            return taskPrams.codeGen.generateCode(finalAst);
          },
          prams: {},
        },
        {
          id: "output",
          cbk: "output",
          task: async (taskPrams) => {
            const result = taskPrams.piplnVar.get("codeGen");
            taskPrams.cli.showOutput(
              "output",
              result,
              "Superoptimizer Result (compile)",
            );
            return result;
          },
          prams: {},
        },
      ],
      "interpret-pipeline": [
        {
          id: "interpreter",
          cbk: "interpreter",
          task: async (taskPrams) => {
            const finalAst = taskPrams.piplnVar.get("optimize");
            return taskPrams.interpreter.inturpret(finalAst);
          },
          prams: {},
        },
        {
          id: "output",
          cbk: "output",
          task: async (taskPrams) => {
            const result = taskPrams.piplnVar.get("interpreter");
            taskPrams.cli.showOutput(
              "output",
              result,
              "Superoptimizer Result (interpret)",
            );
            return result;
          },
          prams: {},
        },
      ],
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
    tokenizer: tokenizer.ins,
    parser: parser.ins,
    astSemantics: astSemantics.ins,
    cas: cas.ins,
    optimizer: optimizer.ins,
    codeGen: codeGen.ins,
    interpreter: interpreter.ins,
    piplnCond: piplnCond.ins,
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
    tokenizer,
    parser,
    astSemantics,
    cas,
    optimizer,
    codeGen,
    interpreter,
    taskPrams,
  };
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});

export { bootstrap };
