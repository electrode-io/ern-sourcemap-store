/// <reference types="../types/index" />

import { expect } from "chai";
import "mocha";
import {
  stackFromNativeString,
  stackFromRedScreenString,
} from "../src/StackHelpers";

describe("StackHelper test suite", () => {
  describe("stackFromNativeString", () => {
    it("should return correct stack", () => {
      const res = stackFromNativeString(`
            BOUM
            value@254:3793
            value@-1
            <unknown>@1823:10455`);
      expect(res).deep.equal([
        {
          column: 3793,
          line: 254,
          methodName: "value",
        },
        {
          column: undefined,
          line: undefined,
          methodName: "value",
        },
        {
          column: 10455,
          line: 1823,
          methodName: "<unknown>",
        },
      ]);
    });
  });

  describe("stackFromRedScreenString", () => {
    it("should return correct stack", () => {
      const res = stackFromRedScreenString(`
              BOUM
              value
                  index.bundle?platform=android&dev=false&minify=true:254:3793
              value
                  [native code]
              <unknown>
                  index.bundle?platform=android&dev=false&minify=true:1823:10455`);
      expect(res).deep.equal([
        {
          column: 3793,
          line: 254,
          methodName: "value",
        },
        {
          column: undefined,
          line: undefined,
          methodName: "value",
        },
        {
          column: 10455,
          line: 1823,
          methodName: "<unknown>",
        },
      ]);
    });
  });
});
