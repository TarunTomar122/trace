/**
 * A small reader for MaxMind DB files (the .mmdb format), enough to look up
 * which country an address belongs to in db-ip.com's "IP to Country Lite"
 * database. Pure: it takes the whole file as bytes and never touches the disk
 * or the network. Spec: https://maxmind.github.io/MaxMind-DB/
 *
 * Only what a lookup needs is here: the metadata, the search tree (24, 28 and
 * 32-bit records) and the data section decoder (every type, pointers
 * included). Country codes are cached per record, so a country lookup
 * after the first one for a record is a tree walk of at most 128 steps.
 */

const METADATA_MARKER = [0xab, 0xcd, 0xef, 0x4d, 0x61, 0x78, 0x4d, 0x69, 0x6e, 0x64, 0x2e, 0x63, 0x6f, 0x6d]; // "\xAB\xCD\xEFMaxMind.com"
/** The metadata sits in the last 128 KiB of the file. */
const METADATA_SEARCH_BYTES = 128 * 1024;
const DATA_SECTION_SEPARATOR = 16;

export type MmdbMetadata = {
  node_count: number;
  record_size: number;
  ip_version: number;
  database_type?: string;
  build_epoch?: number;
  binary_format_major_version?: number;
  [key: string]: unknown;
};

export class MmdbError extends Error {}

function findMetadataStart(buf: Uint8Array): number {
  const stop = Math.max(0, buf.length - METADATA_SEARCH_BYTES);
  outer: for (let i = buf.length - METADATA_MARKER.length; i >= stop; i -= 1) {
    for (let j = 0; j < METADATA_MARKER.length; j += 1) {
      if (buf[i + j] !== METADATA_MARKER[j]) continue outer;
    }
    return i + METADATA_MARKER.length;
  }
  throw new MmdbError("not a MaxMind DB file (no metadata marker)");
}

/** Decodes values from one section of the file; pointers are offsets from `base`. */
class Decoder {
  constructor(private readonly buf: Uint8Array, private readonly base: number) {}

  /** The value at `offset` (relative to `base`) and the offset just after it. */
  decode(offset: number): [unknown, number] {
    let at = this.base + offset;
    const ctrl = this.byte(at++);
    let type = ctrl >> 5;
    if (type === 1) {
      const [pointer, next] = this.pointer(ctrl, at);
      // A pointer's target is decoded where it lives; the cursor carries on after the pointer itself.
      const [value] = this.decode(pointer);
      return [value, next - this.base];
    }
    if (type === 0) {
      type = 7 + this.byte(at++);
      if (type < 8) throw new MmdbError(`bad extended type ${type}`);
    }
    let size = ctrl & 0x1f;
    if (size === 29) size = 29 + this.byte(at++);
    else if (size === 30) {
      size = 285 + ((this.byte(at) << 8) | this.byte(at + 1));
      at += 2;
    } else if (size === 31) {
      size = 65821 + ((this.byte(at) << 16) | (this.byte(at + 1) << 8) | this.byte(at + 2));
      at += 3;
    }
    const [value, next] = this.value(type, size, at);
    return [value, next - this.base];
  }

  private byte(at: number): number {
    if (at >= this.buf.length) throw new MmdbError("read past the end of the file");
    return this.buf[at]!;
  }

  private pointer(ctrl: number, at: number): [number, number] {
    const ss = (ctrl >> 3) & 0x3;
    const vvv = ctrl & 0x7;
    if (ss === 0) return [(vvv << 8) | this.byte(at), at + 1];
    if (ss === 1) return [((vvv << 16) | (this.byte(at) << 8) | this.byte(at + 1)) + 2048, at + 2];
    if (ss === 2) return [(vvv * 0x1000000 + ((this.byte(at) << 16) | (this.byte(at + 1) << 8) | this.byte(at + 2))) + 526336, at + 3];
    return [this.uint(at, 4), at + 4];
  }

  private uint(at: number, size: number): number {
    let n = 0;
    for (let i = 0; i < size; i += 1) n = n * 256 + this.byte(at + i);
    return n;
  }

  private value(type: number, size: number, at: number): [unknown, number] {
    switch (type) {
      case 2: {
        if (at + size > this.buf.length) throw new MmdbError("string runs past the end of the file");
        return [new TextDecoder().decode(this.buf.subarray(at, at + size)), at + size];
      }
      case 3: {
        if (size !== 8) throw new MmdbError("double must be 8 bytes");
        return [new DataView(this.buf.buffer, this.buf.byteOffset + at, 8).getFloat64(0, false), at + 8];
      }
      case 4:
        return [this.buf.slice(at, at + size), at + size];
      case 5:
      case 6:
        return [this.uint(at, size), at + size];
      case 9:
      case 10: {
        // uint64 / uint128: exact as a number up to 2^53, which covers what a lookup reads (build_epoch).
        return [this.uint(at, size), at + size];
      }
      case 7: {
        const out: Record<string, unknown> = {};
        let cursor = at - this.base;
        for (let i = 0; i < size; i += 1) {
          const [key, afterKey] = this.decode(cursor);
          const [value, afterValue] = this.decode(afterKey);
          out[String(key)] = value;
          cursor = afterValue;
        }
        return [out, cursor + this.base];
      }
      case 8: {
        let n = this.uint(at, size);
        if (size === 4 && n >= 0x80000000) n -= 0x100000000;
        return [n, at + size];
      }
      case 11: {
        const out: unknown[] = [];
        let cursor = at - this.base;
        for (let i = 0; i < size; i += 1) {
          const [value, next] = this.decode(cursor);
          out.push(value);
          cursor = next;
        }
        return [out, cursor + this.base];
      }
      case 14:
        return [size !== 0, at];
      case 15: {
        if (size !== 4) throw new MmdbError("float must be 4 bytes");
        return [new DataView(this.buf.buffer, this.buf.byteOffset + at, 4).getFloat32(0, false), at + 4];
      }
      case 12:
      case 13:
        return [null, at];
      default:
        throw new MmdbError(`unknown data type ${type}`);
    }
  }
}

/** "1.2.3.4" or an IPv6 address (with "::", or an embedded IPv4 tail) as bytes; null when it is not an address. */
export function parseIp(input: string): Uint8Array | null {
  const ip = input.trim().replace(/^\[|\]$/g, "").split("%")[0]!;
  if (!ip) return null;
  if (!ip.includes(":")) return parseV4(ip);
  let head = ip;
  let tail: number[] = [];
  const lastColon = ip.lastIndexOf(":");
  if (ip.slice(lastColon + 1).includes(".")) {
    const v4 = parseV4(ip.slice(lastColon + 1));
    if (!v4) return null;
    tail = [(v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!];
    head = ip.slice(0, lastColon + 1);
    // "::1.2.3.4" keeps its "::"; "::ffff:1.2.3.4" drops the colon that only separated the tail.
    if (!head.endsWith("::")) head = head.slice(0, -1);
  }
  const halves = head.split("::");
  if (halves.length > 2) return null;
  const parseGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const left = parseGroups(halves[0]!);
  const right = halves.length === 2 ? parseGroups(halves[1]!) : [];
  const groups: number[] = [];
  for (const g of [...left, ...right]) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }
  const total = left.length + right.length + tail.length;
  if (halves.length === 1 && total !== 8) return null;
  if (halves.length === 2 && total > 7) return null;
  groups.push(...left.map((g) => parseInt(g, 16)));
  if (halves.length === 2) for (let i = 0; i < 8 - total; i += 1) groups.push(0);
  groups.push(...right.map((g) => parseInt(g, 16)), ...tail);
  const out = new Uint8Array(16);
  groups.forEach((g, i) => {
    out[i * 2] = g >> 8;
    out[i * 2 + 1] = g & 0xff;
  });
  // An IPv4-mapped address (::ffff:a.b.c.d) is looked up as the IPv4 address it carries.
  if (out.slice(0, 10).every((b) => b === 0) && out[10] === 0xff && out[11] === 0xff) return out.slice(12);
  return out;
}

function parseV4(ip: string): Uint8Array | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i += 1) {
    const part = parts[i]!;
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out[i] = n;
  }
  return out;
}

export class MmdbReader {
  readonly metadata: MmdbMetadata;
  private readonly nodeCount: number;
  private readonly recordSize: number;
  private readonly nodeBytes: number;
  private readonly treeSize: number;
  private readonly data: Decoder;
  private readonly ipv4Start: number;
  private readonly countries = new Map<number, string | null>();

  constructor(private readonly buf: Uint8Array) {
    const metaStart = findMetadataStart(buf);
    const [meta] = new Decoder(buf, metaStart).decode(0);
    if (!meta || typeof meta !== "object") throw new MmdbError("metadata is not a map");
    this.metadata = meta as MmdbMetadata;
    this.nodeCount = Number(this.metadata.node_count);
    this.recordSize = Number(this.metadata.record_size);
    if (![24, 28, 32].includes(this.recordSize)) throw new MmdbError(`unsupported record size ${this.recordSize}`);
    if (!Number.isInteger(this.nodeCount) || this.nodeCount <= 0) throw new MmdbError("bad node count");
    this.nodeBytes = (this.recordSize * 2) / 8;
    this.treeSize = this.nodeCount * this.nodeBytes;
    if (this.treeSize + DATA_SECTION_SEPARATOR > metaStart) throw new MmdbError("search tree runs into the metadata");
    this.data = new Decoder(buf, this.treeSize + DATA_SECTION_SEPARATOR);
    // In an IPv6 tree, IPv4 addresses live under ::/96: walk 96 zero bits once and start every IPv4 lookup there.
    let node = 0;
    if (Number(this.metadata.ip_version) === 6) {
      for (let i = 0; i < 96 && node < this.nodeCount; i += 1) node = this.record(node, 0);
    }
    this.ipv4Start = node;
  }

  private record(node: number, bit: number): number {
    const at = node * this.nodeBytes;
    const b = this.buf;
    if (this.recordSize === 24) {
      const o = at + bit * 3;
      return (b[o]! << 16) | (b[o + 1]! << 8) | b[o + 2]!;
    }
    if (this.recordSize === 28) {
      if (bit === 0) return ((b[at + 3]! & 0xf0) << 20) | (b[at]! << 16) | (b[at + 1]! << 8) | b[at + 2]!;
      return (b[at + 3]! & 0x0f) * 0x1000000 + ((b[at + 4]! << 16) | (b[at + 5]! << 8) | b[at + 6]!);
    }
    const o = at + bit * 4;
    return b[o]! * 0x1000000 + ((b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!);
  }

  /** Where an address's record starts in the data section, or null when the database has none. */
  private offsetOf(ip: string): number | null {
    const bytes = parseIp(ip);
    if (!bytes) return null;
    if (bytes.length === 16 && Number(this.metadata.ip_version) === 4) return null;
    let node = bytes.length === 4 ? this.ipv4Start : 0;
    const bits = bytes.length * 8;
    for (let i = 0; i < bits && node < this.nodeCount; i += 1) {
      const bit = (bytes[i >> 3]! >> (7 - (i & 7))) & 1;
      node = this.record(node, bit);
    }
    // node_count itself means "no data"; anything below it means the walk ran out of bits inside the tree.
    if (node <= this.nodeCount) return null;
    return node - this.nodeCount - DATA_SECTION_SEPARATOR;
  }

  /** The whole record for an address, or null when the database has none (or the address does not parse). */
  get(ip: string): unknown {
    const offset = this.offsetOf(ip);
    return offset == null ? null : this.data.decode(offset)[0];
  }

  /** Two-letter ISO country code for an address ("US"), or null. Cached per record, so only the code is kept. */
  country(ip: string): string | null {
    const offset = this.offsetOf(ip);
    if (offset == null) return null;
    const cached = this.countries.get(offset);
    if (cached !== undefined) return cached;
    const record = this.data.decode(offset)[0] as { country?: { iso_code?: unknown } } | null;
    const code = record?.country?.iso_code;
    const result = typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
    // A country database has a few hundred distinct records; the cap only guards against an odd file.
    if (this.countries.size > 20_000) this.countries.clear();
    this.countries.set(offset, result);
    return result;
  }
}
