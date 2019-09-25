/// <reference types="../types/index" />

import chai, { expect } from "chai";
import chaiHttp from "chai-http";
import fs from "fs";
import "mocha";
import path from "path";
import shell from "shelljs";
import tmp from "tmp";
import { SourceMapStoreServer } from "../src/SourceMapStoreServer";

describe("SourceMapStoreServer test suite", () => {
  tmp.setGracefulCleanup();
  chai.use(chaiHttp);

  const fixturesPath = path.resolve(__dirname, "fixtures");
  const storeFixturePath = path.join(fixturesPath, "store");

  function createTmpDir() {
    return tmp.dirSync({ unsafeCleanup: true }).name;
  }

  function createServer(config?: SourceMapStoreServerUserConfig) {
    const tmpStoreDir = createTmpDir();
    return new SourceMapStoreServer(
      config || {
        rootPath: tmpStoreDir,
      },
    );
  }

  function binaryParser(res, callback) {
    res.setEncoding("binary");
    res.data = "";
    res.on("data", (chunk) => {
      res.data += chunk;
    });
    res.on("end", () => {
      callback(null, Buffer.from(res.data, "binary"));
    });
  }

  describe("integration tests", () => {
    describe("POST /symbolicate/container/:app/:platform/:version/:containerVersion", () => {
      it("should symbolicate a stack trace as logged by native", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        chai
          .request(sut.app)
          .post("/symbolicate/container/testapp/android/1.0.0/1000.0.10")
          .set("Content-Type", "text/plain")
          .send(
            `BOUM
              onPress@364:619
              touchableHandlePress@203:2130
              touchableHandlePress@195:9628`,
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res.text).equal(`onPress@25:65 [testsm-miniapp/App.js]
touchableHandlePress@213:45 [react-native/Libraries/Components/Touchable/TouchableNativeFeedback.android.js]
touchableHandlePress@878:34 [react-native/Libraries/Components/Touchable/Touchable.js]`);
            done();
          });
      });

      it("should symbolicate a stack trace as logged by red screen", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        chai
          .request(sut.app)
          .post("/symbolicate/container/testapp/android/1.0.0/1000.0.10")
          .set("Content-Type", "text/plain")
          .send(
            `BOUM
            onPress
              index.bundle?platform=android&dev=false&minify=true:364:619
            touchableHandlePress
                index.bundle?platform=android&dev=false&minify=true:203:2130
            touchableHandlePress
              index.bundle?platform=android&dev=false&minify=true:195:9628`,
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res.text).equal(`onPress@25:65 [testsm-miniapp/App.js]
touchableHandlePress@213:45 [react-native/Libraries/Components/Touchable/TouchableNativeFeedback.android.js]
touchableHandlePress@878:34 [react-native/Libraries/Components/Touchable/Touchable.js]`);
            done();
          });
      });
    });

    describe("POST /symbolicate/codepush/:app/:platform/:version/:deploymentName/:label", () => {
      it("should symbolicate a stack trace as logged by native", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        chai
          .request(sut.app)
          .post("/symbolicate/codepush/testapp/android/1.0.0/QA/v10")
          .set("Content-Type", "text/plain")
          .send(
            `BOUM
              onPress@364:619
              touchableHandlePress@203:2130
              touchableHandlePress@195:9628`,
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res.text).equal(`onPress@25:65 [testsm-miniapp/App.js]
touchableHandlePress@213:45 [react-native/Libraries/Components/Touchable/TouchableNativeFeedback.android.js]
touchableHandlePress@878:34 [react-native/Libraries/Components/Touchable/Touchable.js]`);
            done();
          });
      });

      it("should symbolicate a stack trace as logged by red screen", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        chai
          .request(sut.app)
          .post("/symbolicate/codepush/testapp/android/1.0.0/QA/v10")
          .set("Content-Type", "text/plain")
          .send(
            `BOUM
            onPress
              index.bundle?platform=android&dev=false&minify=true:364:619
            touchableHandlePress
                index.bundle?platform=android&dev=false&minify=true:203:2130
            touchableHandlePress
              index.bundle?platform=android&dev=false&minify=true:195:9628`,
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res.text).equal(`onPress@25:65 [testsm-miniapp/App.js]
touchableHandlePress@213:45 [react-native/Libraries/Components/Touchable/TouchableNativeFeedback.android.js]
touchableHandlePress@878:34 [react-native/Libraries/Components/Touchable/Touchable.js]`);
            done();
          });
      });
    });

    describe("POST /sourcemaps/codepush/:app/:platform/:version/:deploymentName/:label", () => {
      it("should add the sourcemap to the store", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/codepush/testapp/android/1.0.0/QA/v11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasCodePushSourceMap({
                app: "testapp",
                deploymentName: "QA",
                label: "v11",
                platform: "android",
                version: "1.0.0",
              }),
            ).true;
            done();
          });
      });

      it("should return HTTP 201", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/codepush/testapp/android/1.0.0/QA/v11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res).to.have.status(201);
            done();
          });
      });

      it("should not remove oldest sourcemap from db for descriptor [maxCodePushMaps not reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxCodePushMaps: -1 });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/codepush/testapp/android/1.0.0/QA/v11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasCodePushSourceMap({
                app: "testapp",
                deploymentName: "QA",
                label: "v10",
                platform: "android",
                version: "1.0.0",
              }),
            ).true;
            done();
          });
      });

      it("should not remove oldest sourcemap file for descriptor [maxCodePushMaps not reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxCodePushMaps: -1 });
        const sourceMapPath = sut.getPathToSourceMap(
          "89558600-dce8-44aa-b0b2-fefb11b6f556",
        );
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/codepush/testapp/android/1.0.0/QA/v11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(fs.existsSync(sourceMapPath)).true;
            done();
          });
      });

      it("should remove oldest sourcemap from db for descriptor [maxCodePushMaps reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxCodePushMaps: 1 });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/codepush/testapp/android/1.0.0/QA/v11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasCodePushSourceMap({
                app: "testapp",
                deploymentName: "QA",
                label: "v10",
                platform: "android",
                version: "1.0.0",
              }),
            ).false;
            done();
          });
      });

      it("should remove oldest sourcemap file for descriptor [maxCodePushMaps reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxCodePushMaps: 1 });
        const sourceMapPath = sut.getPathToSourceMap(
          "89558600-dce8-44aa-b0b2-fefb11b6f556",
        );
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/codepush/testapp/android/1.0.0/QA/v11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(fs.existsSync(sourceMapPath)).false;
            done();
          });
      });
    });

    describe("POST /sourcemaps/container/:app/:platform/:version/:containerVersion", () => {
      it("should add the sourcemap to the store", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/container/testapp/android/1.0.0/v1000.0.11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasContainerSourceMap({
                app: "testapp",
                containerVersion: "v1000.0.11",
                platform: "android",
                version: "1.0.0",
              }),
            );
            done();
          });
      });

      it("should return HTTP 201", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/container/testapp/android/1.0.0/v1000.0.11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res).to.have.status(201);
            done();
          });
      });

      it("should not remove oldest sourcemap from db for descriptor [maxContainerMaps not reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxContainerMaps: -1 });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/container/testapp/android/1.0.0/v1000.0.11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasContainerSourceMap({
                app: "testapp",
                containerVersion: "1000.0.10",
                platform: "android",
                version: "1.0.0",
              }),
            ).true;
            done();
          });
      });

      it("should not remove oldest sourcemap file for descriptor [maxContainerMaps not reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxContainerMaps: -1 });
        const sourceMapPath = sut.getPathToSourceMap(
          "89558600-dce8-44aa-b0b2-fefb11b6f556",
        );
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/container/testapp/android/1.0.0/v1000.0.11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(fs.existsSync(sourceMapPath)).true;
            done();
          });
      });

      it("should remove oldest sourcemap from db for descriptor [maxContainerMaps reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxContainerMaps: 1 });
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/container/testapp/android/1.0.0/v1000.0.11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasContainerSourceMap({
                app: "testapp",
                containerVersion: "1000.0.10",
                platform: "android",
                version: "1.0.0",
              }),
            ).false;
            done();
          });
      });

      it("should remove oldest sourcemap file for descriptor [maxContainerMaps reached]", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir, maxContainerMaps: 1 });
        const sourceMapPath = sut.getPathToSourceMap(
          "89558600-dce8-44aa-b0b2-fefb11b6f556",
        );
        const sourceMapRs = fs.createReadStream(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .post("/sourcemaps/container/testapp/android/1.0.0/v1000.0.11")
          .attach("sourcemap", sourceMapRs)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(fs.existsSync(sourceMapPath)).false;
            done();
          });
      });
    });

    describe("POST /sourcemaps/codepush/copy/:app/:platform/:version/:deploymentName/:label/:toVersion/:toDeploymentName/:toLabel", () => {
      it("should copy the sourcemap in store", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        chai
          .request(sut.app)
          .post(
            "/sourcemaps/codepush/copy/testapp/android/1.0.0/QA/v10/1.0.0/Production/v11",
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(
              sut.db.hasCodePushSourceMap({
                app: "testapp",
                deploymentName: "Production",
                label: "v12",
                platform: "android",
                version: "1.0.0",
              }),
            );
            done();
          });
      });

      it("should return HTTP 201", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        chai
          .request(sut.app)
          .post(
            "/sourcemaps/codepush/copy/testapp/android/1.0.0/QA/v10/1.0.0/Production/v11",
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res).to.have.status(201);
            done();
          });
      });

      it("should return HTTP 404 if the source map does not exist", (done) => {
        const tmpDir = createTmpDir();
        shell.cp("-rf", path.join(storeFixturePath, "*"), tmpDir);
        const sut = createServer({ rootPath: tmpDir });
        chai
          .request(sut.app)
          .post(
            "/sourcemaps/codepush/copy/unknownapp/android/1.0.0/QA/v10/1.0.0/Production/v11",
          )
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res).to.have.status(404);
            done();
          });
      });
    });

    describe("GET /sourcemaps/codepush/:app/:platform/:version/:deploymentName/:label", () => {
      it("should get the source map associated with the code push entry", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        const excpectedSourceMap = fs.readFileSync(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .get("/sourcemaps/codepush/testapp/android/1.0.0/QA/v10")
          .buffer(true)
          .parse(binaryParser)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(Buffer.compare(res.body, excpectedSourceMap)).equal(0);
            done();
          });
      });

      it("should return HTTP 404 if the source map does not exist", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        chai
          .request(sut.app)
          .get("/sourcemaps/codepush/unknownapp/android/1.0.0/QA/v10")
          .buffer(true)
          .parse(binaryParser)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res).to.have.status(404);
            done();
          });
      });
    });

    describe("GET /sourcemaps/container/:app/:platform/:version/:deploymentName/:label", () => {
      it("should get the source map associated with the container entry", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        const excpectedSourceMap = fs.readFileSync(
          path.join(
            storeFixturePath,
            "sourcemaps",
            "89558600-dce8-44aa-b0b2-fefb11b6f556",
          ),
        );
        chai
          .request(sut.app)
          .get("/sourcemaps/container/testapp/android/1.0.0/1000.0.10")
          .buffer(true)
          .parse(binaryParser)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(Buffer.compare(res.body, excpectedSourceMap)).equal(0);
            done();
          });
      });

      it("should return HTTP 404 if the source map does not exist", (done) => {
        const sut = createServer({ rootPath: storeFixturePath });
        chai
          .request(sut.app)
          .get("/sourcemaps/container/unknownapp/android/1.0.0/1000.0.10")
          .buffer(true)
          .parse(binaryParser)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            expect(res).to.have.status(404);
            done();
          });
      });
    });
  });
});
