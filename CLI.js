#!/usr/bin/env node

import { bootstrap } from "./index.js";

async function main() {
  const { piplnMgr, cli, logger, taskPrams } = await bootstrap();

  console.log(cli.header("<Template fillout> — System CLI"));

  const available = piplnMgr.list();
  if (available.length === 0) {
    logger.warn(
      "autoCLI",
      "No pipelines registered yet. Add pipelines in index.js.",
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
  console.error("[CLI] Fatal error:", err);
  process.exit(1);
});
