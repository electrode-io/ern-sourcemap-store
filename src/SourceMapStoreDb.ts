/// <reference types="../types/index" />

import debug from "debug";
import fs from "fs";
import _ from "lodash";
import path from "path";
import shell from "shelljs";

export class SourceMapStoreDb {
  public readonly dbPath: string;

  private readonly d = debug("SourceMapStoreDb");

  private db: Db;

  constructor({
    dbPath,
    seed = {
      codePushSourceMaps: [],
      containerSourceMaps: [],
    },
  }: {
    dbPath: string;
    seed?: Db;
  }) {
    this.d(`ctor(dbPath: ${dbPath}, seed: ${seed})`);
    this.dbPath = dbPath;
    if (!fs.existsSync(dbPath)) {
      shell.mkdir("-p", path.dirname(dbPath));
      this.db = seed;
      fs.writeFileSync(dbPath, JSON.stringify(this.db));
      this.d(`created new database in ${dbPath}`);
    } else {
      this.d(`using db : ${this.dbPath}`);
      this.db = JSON.parse(fs.readFileSync(this.dbPath).toString());
    }
  }

  public get data(): Db {
    return JSON.parse(JSON.stringify(this.db));
  }

  public hasCodePushSourceMap(descriptor: CodePushDescriptor): boolean {
    return this.db.codePushSourceMaps.some((s) =>
      _.isEqual(descriptor, s.descriptor),
    );
  }

  public hasContainerSourceMap(descriptor: ContainerDescriptor): boolean {
    return this.db.containerSourceMaps.some((s) =>
      _.isEqual(descriptor, s.descriptor),
    );
  }

  public getCodePushSourceMapEntry(
    descriptor: CodePushDescriptor,
  ): CodePushSourceMapEntry {
    this.throwIfCodePushSourceMapEntryDoesNotExist(descriptor);
    return _.find(this.db.codePushSourceMaps, (s) =>
      _.isEqual(descriptor, s.descriptor),
    );
  }

  public getCodePushSourceMapEntries(
    descriptor: AppDescriptor,
  ): CodePushSourceMapEntry[] {
    return this.db.codePushSourceMaps.filter(
      (s) =>
        descriptor.app === s.descriptor.app &&
        descriptor.platform === s.descriptor.platform &&
        descriptor.version === s.descriptor.version,
    );
  }

  public getContainerSourceMapEntry(
    descriptor: ContainerDescriptor,
  ): ContainerSourceMapEntry {
    this.throwIfContainerSourceMapEntryDoesNotExist(descriptor);
    return _.find(this.db.containerSourceMaps, (s) =>
      _.isEqual(descriptor, s.descriptor),
    );
  }

  public getContainerSourceMapEntries(
    descriptor: AppDescriptor,
  ): ContainerSourceMapEntry[] {
    return this.db.containerSourceMaps.filter(
      (s) =>
        descriptor.app === s.descriptor.app &&
        descriptor.platform === s.descriptor.platform &&
        descriptor.version === s.descriptor.version,
    );
  }

  public addCodePushSourceMapEntry(
    entry: CodePushSourceMapEntry,
  ): CodePushSourceMapEntry {
    this.db.codePushSourceMaps.push(entry);
    this.write();
    return entry;
  }

  public delCodePushSourceMapEntry(
    entry: CodePushSourceMapEntry,
  ): CodePushSourceMapEntry {
    _.remove(this.db.codePushSourceMaps, (s) => _.isEqual(s, entry));
    this.write();
    return entry;
  }

  public addContainerSourceMapEntry(
    entry: ContainerSourceMapEntry,
  ): ContainerSourceMapEntry {
    this.db.containerSourceMaps.push(entry);
    this.write();
    return entry;
  }

  public delContainerSourceMapEntry(
    entry: ContainerSourceMapEntry,
  ): ContainerSourceMapEntry {
    _.remove(this.db.containerSourceMaps, (s) => _.isEqual(s, entry));
    this.write();
    return entry;
  }

  public throwIfCodePushSourceMapEntryDoesNotExist(
    descriptor: CodePushDescriptor,
  ): never | void {
    if (!this.hasCodePushSourceMap(descriptor)) {
      throw new Error(
        `CodePush source map for ${JSON.stringify(
          descriptor,
          null,
          2,
        )} does not exist in database.`,
      );
    }
  }

  public throwIfContainerSourceMapEntryDoesNotExist(
    descriptor: ContainerDescriptor,
  ): never | void {
    if (!this.hasContainerSourceMap(descriptor)) {
      throw new Error(
        `Container source map for ${JSON.stringify(
          descriptor,
          null,
          2,
        )} does not exist in database.`,
      );
    }
  }

  public write() {
    this.d(`write database`);
    fs.writeFileSync(this.dbPath, JSON.stringify(this.db));
  }
}
