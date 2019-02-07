/* @flow */

import * as assert from "assert";
import { describe, it } from "mocha";

import { int32 } from "@capnp-js/read-data";

import nonboolListTag from "../../src/nonboolListTag";

describe("nonboolListTag", function () {
  const segment = { id: 0, raw: new Uint8Array(8), end: 8 };
  const object = {
    segment,
    position: 0,
  };

  it("decodes data section size and pointers section size from a list tag word", function () {
    nonboolListTag(object, 11, {data: 288, pointers: 520});

    assert.equal(int32(segment.raw, 0), (11<<2) | 0x00);
    assert.equal(int32(segment.raw, 4), (520<<13) | (288>>>3));
  });
});
