#!/usr/bin/env node
// CLI.js — Standalone CLI entrypoint
// Running this file starts the entire system AND the interactive CLI.
// Uses oclif, chalk, boxen, ora, inquirer standards as per Auto CLI README.

import chalk from "chalk";
import { header } from "./processes/Auto Command Line Interface/index.js";
import { bootstrap } from "./index.js";

async function main() {
  console.log(header("<Template fillout> — System CLI"));

  const { piplnMgr, cli, logger, taskPrams } = await bootstrap();

  // List available pipelines and let the user pick one interactively
  const available = piplnMgr.list();

  if (available.length === 0) {
    console.log(
      chalk.yellow("No pipelines registered yet. Add pipelines in index.js."),
    );
    return;
  }

  const selected = await cli.pickPipeline(available);
  if (!selected) return;

  logger.task("autoCLI", `Running pipeline: ${selected}`);
  await piplnMgr.switchPipeline(selected, taskPrams);
  cli.showPipelineState(taskPrams);
}

main().catch((err) => {
  console.error(chalk.red("[CLI] Fatal error:"), err);
  process.exit(1);
});
