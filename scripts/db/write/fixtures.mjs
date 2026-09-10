/**
 * Real image files, generated rather than committed.
 *
 * The media suite needs genuine images: the portal identifies an upload from
 * its first bytes, not from its filename, so a text file with a .png extension
 * is refused — correctly, and that refusal is one of the things under test.
 * The suite used to read two photographs out of the archived prototype folder,
 * which is deliberately not published, so a clean clone could not run it.
 *
 * These are complete, valid PNGs — signature, IHDR, a zlib-compressed IDAT of
 * real pixels, IEND, every chunk with its own CRC. Nothing here loosens what
 * the portal checks; it produces files that genuinely satisfy it.
 *
 * PNG rather than JPEG on purpose. A correct JPEG needs quantisation and
 * Huffman tables and entropy-coded data, and hand-writing one would be a large
 * piece of code whose bugs would look like portal bugs. A PNG is a handful of
 * length-prefixed chunks over `zlib`, which Node already has.
 */
import fs from "node:fs";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: length, type, payload, CRC over type+payload. */
function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);

  const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

/**
 * A small RGB PNG, tinted by `hue`.
 *
 * The gradient is there so two fixtures with different hues differ over most
 * of their bytes rather than in a couple of header fields — "replace it with
 * something visibly different" should mean something.
 */
export function pngBytes({ width = 64, height = 64, hue = 0 } = {}) {
  const raw = Buffer.alloc(height * (1 + width * 3));

  let at = 0;
  for (let y = 0; y < height; y++) {
    /* Filter byte 0 — this row is stored as-is. */
    raw[at++] = 0;
    for (let x = 0; x < width; x++) {
      raw[at++] = (hue + x * 3) & 0xff;
      raw[at++] = (hue * 2 + y * 3) & 0xff;
      raw[at++] = (hue * 3 + ((x + y) << 1)) & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; /* bit depth */
  ihdr[9] = 2; /* colour type: truecolour RGB */
  ihdr[10] = 0; /* compression: deflate */
  ihdr[11] = 0; /* filter: adaptive */
  ihdr[12] = 0; /* interlace: none */

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Writes one to disk and hands back the path. */
export function writePng(filePath, options) {
  fs.writeFileSync(filePath, pngBytes(options));
  return filePath;
}
