/// <reference types="../types/index" />

import debug from "debug";
import express from "express";
import fs from "fs";
import _ from "lodash";
import multer from "multer";
import path from "path";
import shell from "shelljs";
import uuidv4 from "uuid/v4";
import { SourceMapStoreDb } from "./SourceMapStoreDb";
import {
  stackFromNativeString,
  stackFromRedScreenString,
  stackToString,
  symbolicate,
} from "./StackHelpers";

export class SourceMapStoreServer {
  public readonly app: express.Application;
  public readonly db: SourceMapStoreDb;
  public readonly config: SourceMapStoreServerConfig;
  public readonly storage: multer.StorageEngine;

  private readonly d = debug("SourceMapStoreServer");

  constructor(public readonly conf: SourceMapStoreServerUserConfig) {
    this.config = this.normalizeUserConfig(conf);
    this.createDirectories();
    this.app = express();
    this.setupMiddlewares();
    this.db = new SourceMapStoreDb({
      dbPath: this.config.paths.db,
      seed: this.config.dbSeed,
    });
    this.storage = this.createMulterStorage();
    this.createAppRoutes();
  }

  public normalizeUserConfig(
    config: SourceMapStoreServerUserConfig,
  ): SourceMapStoreServerConfig {
    const cwd = process.cwd();
    return {
      dbSeed: config.dbSeed,
      host: config.host,
      maxCodePushMaps: config.maxCodePushMaps || -1,
      maxContainerMaps: config.maxContainerMaps || -1,
      paths: config.paths
        ? config.paths
        : config.rootPath
        ? {
            db: path.join(config.rootPath, "db.json"),
            sourcemaps: path.join(config.rootPath, "sourcemaps"),
          }
        : {
            db: path.join(cwd, "db.json"),
            sourcemaps: path.join(cwd, "sourcemaps"),
          },
      port: config.port || 3000,
    };
  }

  public getPathToSourceMap(sourceMap: string) {
    return path.join(this.config.paths.sourcemaps, sourceMap);
  }

  public containerDescriptorFrom(p: any): ContainerDescriptor {
    return {
      app: p.app,
      containerVersion: p.containerVersion,
      platform: p.platform,
      version: p.version,
    };
  }

  public codePushDescriptorFrom(p: any): CodePushDescriptor {
    return {
      app: p.app,
      deploymentName: p.deploymentName,
      label: p.label,
      platform: p.platform,
      version: p.version,
    };
  }

  public start() {
    this.app.listen(this.config.port, this.config.host, () =>
      this.d(
        `Electrode Native sourcemap store server listening on port ${this.config.port}`,
      ),
    );
  }

  private createDirectories() {
    shell.mkdir(
      "-p",
      path.dirname(this.config.paths.db),
      this.config.paths.sourcemaps,
    );
  }

  private setupMiddlewares() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      if (req.is("text/*")) {
        req.text = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => (req.text += chunk));
        req.on("end", next);
      } else {
        next();
      }
    });
  }

  private createMulterStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.config.paths.sourcemaps);
      },
      filename: (req, file, cb) => {
        cb(null, req.params.sourceMapId);
      },
    });
  }

  private addSourceMapIdToReqParams(req, res, next) {
    req.params.sourceMapId = uuidv4();
    next();
  }

  private cleanupContainerEntries(descriptor: AppDescriptor) {
    const entries = this.db.getContainerSourceMapEntries(descriptor);
    if (
      this.config.maxContainerMaps !== -1 &&
      entries &&
      entries.length >= this.config.maxContainerMaps
    ) {
      const oldestEntry = _.first(entries);
      shell.rm("-rf", this.getPathToSourceMap(oldestEntry.sourcemap));
      this.db.delContainerSourceMapEntry(oldestEntry);
    }
  }

  private cleanupCodePushEntries(descriptor: AppDescriptor) {
    const entries = this.db.getCodePushSourceMapEntries(descriptor);
    if (
      this.config.maxCodePushMaps !== -1 &&
      entries &&
      entries.length >= this.config.maxCodePushMaps
    ) {
      const oldestEntry = _.first(entries);
      shell.rm("-rf", this.getPathToSourceMap(oldestEntry.sourcemap));
      this.db.delCodePushSourceMapEntry(oldestEntry);
    }
  }

  private createAppRoutes() {
    const upload = multer({ storage: this.storage });

    this.app.get("/status", (req, res) => {
      res.sendStatus(200);
    });

    this.app.post(
      "/symbolicate/container/:app/:platform/:version/:containerVersion",
      async (req, res) => {
        let stack = stackFromNativeString(req.text);
        stack = stack.length !== 0 ? stack : stackFromRedScreenString(req.text);
        const descriptor = this.containerDescriptorFrom(req.params);
        const entry = this.db.getContainerSourceMapEntry(descriptor);
        const sourceMap = this.getPathToSourceMap(entry.sourcemap);
        const sourceMapStr = fs.readFileSync(sourceMap).toString();
        const resultStack = await symbolicate(stack, sourceMapStr);
        res.status(200).send(stackToString(resultStack));
      },
    );

    this.app.post(
      "/symbolicate/codepush/:app/:platform/:version/:deploymentName/:label",
      async (req, res) => {
        let stack = stackFromNativeString(req.text);
        stack = stack.length !== 0 ? stack : stackFromRedScreenString(req.text);
        const descriptor = this.codePushDescriptorFrom(req.params);
        const entry = this.db.getCodePushSourceMapEntry(descriptor);
        const sourceMap = this.getPathToSourceMap(entry.sourcemap);
        const sourceMapStr = fs.readFileSync(sourceMap).toString();
        const resultStack = await symbolicate(stack, sourceMapStr);
        res.status(200).send(stackToString(resultStack));
      },
    );

    this.app.get(
      "/sourcemaps/container/:app/:platform/:version/:containerVersion",
      (req, res) => {
        const descriptor = this.containerDescriptorFrom(req.params);
        if (!this.db.hasContainerSourceMap(descriptor)) {
          return res
            .status(404)
            .send(`No source map in store for ${descriptor}`);
        }
        const entry = this.db.getContainerSourceMapEntry(descriptor);
        const sourceMap = this.getPathToSourceMap(entry.sourcemap);
        res.sendFile(sourceMap);
      },
    );

    this.app.get(
      "/sourcemaps/codepush/:app/:platform/:version/:deploymentName/:label",
      (req, res) => {
        const descriptor = this.codePushDescriptorFrom(req.params);
        if (!this.db.hasCodePushSourceMap(descriptor)) {
          return res
            .status(404)
            .send(`No source map in store for ${descriptor}`);
        }
        const entry = this.db.getCodePushSourceMapEntry(descriptor);
        const sourceMap = this.getPathToSourceMap(entry.sourcemap);
        res.sendFile(sourceMap);
      },
    );

    this.app.post(
      "/sourcemaps/container/:app/:platform/:version/:containerVersion",
      this.addSourceMapIdToReqParams.bind(this),
      upload.single("sourcemap").bind(this),
      (req, res) => {
        const descriptor = this.containerDescriptorFrom(req.params);
        this.cleanupContainerEntries(descriptor);
        this.db.addContainerSourceMapEntry({
          descriptor,
          sourcemap: req.params.sourceMapId,
          timestamp: Date.now(),
        });
        res.sendStatus(201);
      },
    );

    this.app.post(
      "/sourcemaps/codepush/:app/:platform/:version/:deploymentName/:label",
      this.addSourceMapIdToReqParams.bind(this),
      upload.single("sourcemap").bind(this),
      (req, res) => {
        const descriptor = this.codePushDescriptorFrom(req.params);
        this.cleanupCodePushEntries(descriptor);
        this.db.addCodePushSourceMapEntry({
          descriptor,
          sourcemap: req.params.sourceMapId,
          timestamp: Date.now(),
        });
        res.sendStatus(201);
      },
    );

    this.app.post(
      "/sourcemaps/codepush/copy/:app/:platform/:version/:deploymentName/:label/:toVersion/:toDeploymentName/:toLabel",
      this.addSourceMapIdToReqParams.bind(this),
      (req, res) => {
        const descriptor = this.codePushDescriptorFrom(req.params);
        this.cleanupCodePushEntries(descriptor);
        if (!this.db.hasCodePushSourceMap(descriptor)) {
          return res
            .status(404)
            .send(`No source map in store for ${descriptor}`);
        }
        const entry = this.db.getCodePushSourceMapEntry(descriptor);
        const sourceMap = this.getPathToSourceMap(entry.sourcemap);
        const sourceMapCopyUuid = uuidv4();
        const sourceMapCopy = this.getPathToSourceMap(sourceMapCopyUuid);
        const smws = fs.createWriteStream(sourceMapCopy);
        const newDescriptor = {
          app: descriptor.app,
          deploymentName: req.params.toDeploymentName,
          label: req.params.toLabel,
          platform: descriptor.platform,
          version: req.params.toVersion,
        };
        fs.createReadStream(sourceMap).pipe(smws);
        this.db.addCodePushSourceMapEntry({
          descriptor: newDescriptor,
          sourcemap: sourceMapCopyUuid,
          timestamp: Date.now(),
        });
        res.sendStatus(201);
      },
    );

    this.app.get("/db", (req, res) => {
      res.status(200).json(this.db.data);
    });
  }
}
