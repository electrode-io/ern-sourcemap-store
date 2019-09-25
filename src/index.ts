#!/usr/bin/env node
import program from "commander";
import path from "path";
import { SourceMapStoreServer } from "./SourceMapStoreServer";

const DEFAULT_MAX_CODEPUSH_MAPS = -1;
const DEFAULT_MAX_CONTAINER_MAPS = -1;
const DEFAULT_PORT = 3000;
const DEFAULT_STORE_PATH = path.join(process.cwd(), "store");

program
  .option("--host <string>", "sever host/ip")
  .option(
    "--max-container-maps <number>",
    "maximum number of container source maps to keep (per application version)",
    DEFAULT_MAX_CONTAINER_MAPS,
  )
  .option(
    "--max-codepush-maps <number>",
    "maximum number of code push source maps to keep (per application version)",
    DEFAULT_MAX_CODEPUSH_MAPS,
  )
  .option("--port <number>", "server port", DEFAULT_PORT)
  .option("--store-path <string>", "store path", DEFAULT_STORE_PATH)
  .parse(process.argv);

new SourceMapStoreServer({
  host: program.host,
  maxCodePushMaps: program.maxCodepushMaps || DEFAULT_MAX_CODEPUSH_MAPS,
  maxContainerMaps: program.maxContainerMaps || DEFAULT_MAX_CONTAINER_MAPS,
  port: program.port || DEFAULT_PORT,
  rootPath: program.storePath,
}).start();
