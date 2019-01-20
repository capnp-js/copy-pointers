/* @flow */

import type {
  Bytes,
  NonboolListFlag,
  StructLayout,
  BoolListLayout,
  NonboolListLayout,
} from "@capnp-js/layout";

import type { Word, SegmentR, SegmentB } from "@capnp-js/memory";

import type { ArenaR } from "@capnp-js/reader-core";
import type { ArenaB } from "@capnp-js/builder-core";

import { isNull } from "@capnp-js/memory";
import { u3_mask } from "@capnp-js/tiny-uint";
import { int32 } from "@capnp-js/write-data";

import nonboolListTag from "./nonboolListTag";

type uint = number;

function pointerCopy(
  arena: ArenaR, source: Word<SegmentR>, level: uint,
  targetArena: ArenaB, target: Word<SegmentB>
): void {
  if (isNull(source)) {
    targetArena.zero(target, 8);
  } else {
    const p = arena.pointer(source);
    if (p.typeBits === 0x00) {
      arena.structCopy(arena.genericStructLayout(p), source.segment, level, targetArena, target);
    } else if (p.typeBits === 0x01) {
      const type = u3_mask(p.hi, 0x07);
      if (type === 0x01) {
        arena.boolListCopy(arena.boolListLayout(p), p.object.segment, level, targetArena, target);
      } else {
        (type: NonboolListFlag);
        arena.nonboolListCopy(arena.genericNonboolListLayout(p), p.object.segment, level, targetArena, target);
      }
    } else {
      (p.typeBits: 0x03);
      /* Technically, no far pointer should lead to a capability, but I make
       * believe that it could happen. */
      int32(0x03, target.segment.raw, target.position);
      int32(p.hi>>>0, target.segment.raw, target.position+4);
    }
  }
}

export function structCopy(
  arena: ArenaR, layout: StructLayout, segment: SegmentR, level: uint,
  targetArena: ArenaB, object: Word<SegmentB>
): void {
  const source = {
    segment,
    position: layout.dataSection,
  };

  targetArena.write(source, layout.bytes.data, object);

  source.position = layout.pointersSection;
  const target = {
    segment: object.segment,
    position: object.position + layout.bytes.data,
  };
  for (; source.position<layout.end; source.position+=8,
                                     target.position+=8) {
    pointerCopy(arena, source, level+1, targetArena, target);
  }
}

export function fixedWidthStructCopy(
  arena: ArenaR, layout: StructLayout, segment: SegmentR,
  level: uint, targetArena: ArenaB, object: Word<SegmentB>, fixed: Bytes
): void {
  const source = {
    segment,
    position: layout.dataSection,
  };
  const target = {
    segment: object.segment,
    position: object.position,
  };

  if (layout.bytes.data < fixed.data) {
    targetArena.write(source, layout.bytes.data, target);

    /* Zero the remainder. */
    target.position += layout.bytes.data;
    targetArena.zero(target, fixed.data - layout.bytes.data);
  } else {
    /* Truncated source into target. */
    targetArena.write(source, fixed.data, target);
  }

  source.position = layout.pointersSection;
  target.position = object.position + fixed.data;
  if (layout.bytes.pointers < fixed.pointers) {
    for (; source.position<layout.end; source.position+=8,
                                       target.position+=8) {
      pointerCopy(arena, source, level+1, targetArena, target);
    }

    /* Zero the remainder. */
    targetArena.zero(target, fixed.pointers - layout.bytes.pointers);
  } else {
    /* Truncated source into target. */
    const end = layout.pointersSection + fixed.pointers;
    for (; source.position<end; source.position+=8,
                                target.position+=8) {
      pointerCopy(arena, source, level+1, targetArena, target);
    }
  }
}

export function boolListCopy(
  layout: BoolListLayout, segment: SegmentR,
  targetArena: ArenaB, object: Word<SegmentB>, bytes: uint
): void {
  //TODO: Change variable name `bytes` to `wordAlignedBytes`, then verify that call sites word align.
  const source = {
    segment,
    position: layout.begin,
  };
  targetArena.write(source, bytes, object);
}

export function nonboolListCopy(
  arena: ArenaR, layout: NonboolListLayout, segment: SegmentR, level: uint,
  targetArena: ArenaB, object: Word<SegmentB>, bytes: uint
): void {
  const source = {
    segment: segment,
    position: layout.begin,
  };
  const target = {
    segment: object.segment,
    position: object.position,
  };

  if (layout.encoding.flag === 0x07) {
    /* Write the tag. Since the tag may not exist, write it from metadata. */
    nonboolListTag(target, layout.length, layout.encoding.bytes);

    /* Prepare for copying. */
    target.position += 8;
    bytes -= 8;

    const encoding = layout.encoding;
    const width = encoding.bytes.data + encoding.bytes.pointers; /* Word Aligned */
    const structLayout = {
      tag: "struct",
      bytes: encoding.bytes,
      dataSection: source.position,
      pointersSection: source.position + encoding.bytes.data,
      end: source.position + width,
    };
    const end = target.position + bytes;
    for (; target.position<end; structLayout.dataSection+=width,
                                structLayout.pointersSection+=width,
                                structLayout.end+=width,
                                target.position+=width) {
      /* No increment on `level` because the structs are inline. */
      structCopy(arena, structLayout, segment, level, targetArena, target);
    }
  } else if (layout.encoding.flag === 0x06) {
    const end = target.position + bytes;
    for (; target.position<end; source.position+=8,
                                target.position+=8) {
      pointerCopy(arena, source, level+1, targetArena, target);
    }
  } else {
    (layout.encoding.flag: 0x00 | 0x02 | 0x03 | 0x04 | 0x05);
    targetArena.write(source, bytes, target);
  }
}
