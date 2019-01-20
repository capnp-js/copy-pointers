/* @flow */

import test from "ava";

import { int32 } from "@capnp-js/read-data";

import nonboolListTag from "../../src/nonboolListTag";

test("`nonboolListTag`", t => {
  t.plan(2);

  const segment = {
    id: 0,
    raw: new Uint8Array(8),
    end: 8,
  };

  const object = {
    segment,
    position: 0,
  };

  nonboolListTag(object, 11, {data: 288, pointers: 520});

  t.is(int32(segment.raw, 0), (11<<2) | 0x00);
  t.is(int32(segment.raw, 4), (520<<13) | (288>>>3));
});
