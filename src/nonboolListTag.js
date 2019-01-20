/* @flow */

import type { Bytes } from "@capnp-js/layout";
import type { SegmentB, Word } from "@capnp-js/memory";

import { structHi } from "@capnp-js/layout";
import { int32 } from "@capnp-js/write-data";

type u30 = number;

export default function nonboolListTag(object: Word<SegmentB>, length: u30, bytes: Bytes): void {
  int32(length<<2, object.segment.raw, object.position);
  int32(structHi(bytes), object.segment.raw, object.position+4);
}
