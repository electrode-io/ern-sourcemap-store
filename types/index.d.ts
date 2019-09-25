declare type Platform = "android" | "ios";

declare interface StackFrame {
  arguments?: any[];
  column?: number;
  file?: string;
  line?: number;
  methodName: string;
}

declare interface AppDescriptor {
  app: string;
  platform: Platform;
  version: string;
}

declare interface ContainerDescriptor extends AppDescriptor {
  containerVersion: string;
}

declare interface CodePushDescriptor extends AppDescriptor {
  deploymentName: string;
  label: string;
}

declare interface CodePushSourceMapEntry {
  descriptor: CodePushDescriptor;
  sourcemap: string;
  timestamp: number;
}

declare interface ContainerSourceMapEntry {
  descriptor: ContainerDescriptor;
  sourcemap: string;
  timestamp: number;
}

declare interface Db {
  codePushSourceMaps: CodePushSourceMapEntry[];
  containerSourceMaps: ContainerSourceMapEntry[];
}

declare interface SourceMapStoreServerPaths {
  db: string;
  sourcemaps: string;
}

declare interface SourceMapStoreServerConfig {
  dbSeed?: Db;
  host?: string;
  maxCodePushMaps: number;
  maxContainerMaps: number;
  port: number;
  rootPath?: string;
  paths?: SourceMapStoreServerPaths;
}

declare type SourceMapStoreServerUserConfig = Partial<
  SourceMapStoreServerConfig
>;

declare namespace Express {
  export interface Request {
    text: string;
    params: any;
  }
}
