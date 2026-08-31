import { deflateRawSync, gunzipSync, gzipSync, inflateRawSync } from "node:zlib";

export type ArchiveEntry = {
  body: Uint8Array;
  mode: 0o644 | 0o755;
  name: string;
};

const SAFE_NAME = /^[A-Za-z0-9._-]+$/u;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;

function entriesInOrder(entries: ArchiveEntry[]): ArchiveEntry[] {
  if (entries.length === 0) throw new Error("release archive is empty");
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name, "en"));
  const seen = new Set<string>();
  for (const entry of sorted) {
    if (!SAFE_NAME.test(entry.name) || entry.name === "." || entry.name === "..") {
      throw new Error(`invalid release archive entry: ${entry.name}`);
    }
    if (seen.has(entry.name)) throw new Error(`duplicate release archive entry: ${entry.name}`);
    if (entry.mode !== 0o644 && entry.mode !== 0o755) {
      throw new Error(`invalid release archive mode: ${entry.name}`);
    }
    seen.add(entry.name);
  }
  return sorted;
}

function writeString(target: Buffer, offset: number, length: number, value: string): void {
  const body = Buffer.from(value, "utf8");
  if (body.byteLength > length) throw new Error(`archive field is too long: ${value}`);
  body.copy(target, offset);
}

function writeOctal(target: Buffer, offset: number, length: number, value: number): void {
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length >= length) throw new Error(`tar numeric field is too large: ${value}`);
  writeString(target, offset, length, `${encoded}\0`);
}

function tarHeader(entry: ArchiveEntry): Buffer {
  const header = Buffer.alloc(512);
  writeString(header, 0, 100, entry.name);
  writeOctal(header, 100, 8, entry.mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, entry.body.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

export function createTarGz(entries: ArchiveEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entriesInOrder(entries)) {
    const body = Buffer.from(entry.body);
    chunks.push(tarHeader(entry), body);
    const remainder = body.byteLength % 512;
    if (remainder) chunks.push(Buffer.alloc(512 - remainder));
  }
  chunks.push(Buffer.alloc(1024));
  const compressed = Buffer.from(gzipSync(Buffer.concat(chunks), { level: 9 }));
  compressed.writeUInt32LE(0, 4);
  compressed[9] = 255;
  return compressed;
}

function readOctal(field: Uint8Array): number {
  const value = Buffer.from(field).toString("ascii").replace(/\0.*$/u, "").trim();
  if (!/^[0-7]+$/u.test(value)) throw new Error("invalid tar numeric field");
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("invalid tar numeric field");
  return parsed;
}

function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

function readTarEntries(archive: Uint8Array): ArchiveEntry[] {
  if (archive.byteLength < 18 || archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("tar gzip has invalid compressed size");
  }
  const compressed = Buffer.from(archive);
  if (
    compressed[0] !== 0x1f ||
    compressed[1] !== 0x8b ||
    compressed[2] !== 0x08 ||
    compressed[3] !== 0 ||
    compressed.readUInt32LE(4) !== 0 ||
    compressed[9] !== 255
  ) {
    throw new Error("gzip header is not canonical");
  }
  const tar = gunzipSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
  const entries: ArchiveEntry[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let terminated = false;
  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512);
    if (isZeroBlock(header)) {
      if (
        offset + 1024 > tar.byteLength ||
        !isZeroBlock(tar.subarray(offset + 512, offset + 1024))
      ) {
        throw new Error("tar archive lacks two-block terminator");
      }
      if (!isZeroBlock(tar.subarray(offset + 1024))) {
        throw new Error("tar archive has trailing payload");
      }
      terminated = true;
      break;
    }
    const checksum = readOctal(header.subarray(148, 156));
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    if (checksum !== checksumHeader.reduce((sum, byte) => sum + byte, 0)) {
      throw new Error("tar header checksum mismatch");
    }
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, "");
    const mode = readOctal(header.subarray(100, 108));
    const uid = readOctal(header.subarray(108, 116));
    const gid = readOctal(header.subarray(116, 124));
    const size = readOctal(header.subarray(124, 136));
    const mtime = readOctal(header.subarray(136, 148));
    if (
      !SAFE_NAME.test(name) ||
      name === "." ||
      name === ".." ||
      seen.has(name) ||
      (mode !== 0o644 && mode !== 0o755) ||
      uid !== 0 ||
      gid !== 0 ||
      mtime !== 0 ||
      header[156] !== "0".charCodeAt(0) ||
      header.subarray(257, 263).toString("binary") !== "ustar\0" ||
      header.subarray(263, 265).toString("binary") !== "00"
    ) {
      throw new Error(`invalid tar entry metadata: ${name || "unnamed"}`);
    }
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const next = dataStart + Math.ceil(size / 512) * 512;
    if (dataEnd > tar.byteLength || next > tar.byteLength) {
      throw new Error(`truncated tar entry: ${name}`);
    }
    if (!isZeroBlock(tar.subarray(dataEnd, next))) {
      throw new Error(`non-zero tar padding: ${name}`);
    }
    entries.push({ body: Buffer.from(tar.subarray(dataStart, dataEnd)), mode, name });
    seen.add(name);
    offset = next;
  }
  if (!terminated || entries.length === 0) throw new Error("invalid tar archive termination");
  return entries;
}

export function readTarGz(archive: Uint8Array): Map<string, ArchiveEntry> {
  const entries = readTarEntries(archive);
  if (!createTarGz(entries).equals(Buffer.from(archive))) {
    throw new Error("tar gzip bytes are not canonical");
  }
  return new Map(entries.map((entry) => [entry.name, entry]));
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(body: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of body) value = (value >>> 8) ^ (crcTable[(value ^ byte) & 0xff] ?? 0);
  return (value ^ 0xffffffff) >>> 0;
}

function zipLocalHeader(entry: ArchiveEntry, compressed: Buffer, checksum: number): Buffer {
  const name = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(30 + name.byteLength);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(compressed.byteLength, 18);
  header.writeUInt32LE(entry.body.byteLength, 22);
  header.writeUInt16LE(name.byteLength, 26);
  header.writeUInt16LE(0, 28);
  name.copy(header, 30);
  return header;
}

function zipCentralHeader(
  entry: ArchiveEntry,
  compressed: Buffer,
  checksum: number,
  offset: number,
): Buffer {
  const name = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(46 + name.byteLength);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x21, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(compressed.byteLength, 20);
  header.writeUInt32LE(entry.body.byteLength, 24);
  header.writeUInt16LE(name.byteLength, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((entry.mode << 16) >>> 0, 38);
  header.writeUInt32LE(offset, 42);
  name.copy(header, 46);
  return header;
}

export function createZip(entries: ArchiveEntry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entriesInOrder(entries)) {
    const body = Buffer.from(entry.body);
    const compressed = deflateRawSync(body, { level: 9 });
    const checksum = crc32(body);
    const header = zipLocalHeader(entry, compressed, checksum);
    local.push(header, compressed);
    central.push(zipCentralHeader(entry, compressed, checksum, offset));
    offset += header.byteLength + compressed.byteLength;
  }
  const centralBody = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralBody.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBody, end]);
}

type ZipRecord = ArchiveEntry & {
  compressedSize: number;
  crc: number;
  localOffset: number;
};

export function readZip(archive: Uint8Array): Map<string, ArchiveEntry> {
  if (archive.byteLength < 22 || archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("zip has invalid size");
  }
  const body = Buffer.from(archive);
  const endOffset = body.byteLength - 22;
  if (
    body.readUInt32LE(endOffset) !== 0x06054b50 ||
    body.readUInt16LE(endOffset + 4) !== 0 ||
    body.readUInt16LE(endOffset + 6) !== 0 ||
    body.readUInt16LE(endOffset + 20) !== 0
  ) {
    throw new Error("zip end record is invalid");
  }
  const count = body.readUInt16LE(endOffset + 8);
  if (count === 0 || body.readUInt16LE(endOffset + 10) !== count) {
    throw new Error("zip entry count is invalid");
  }
  const centralSize = body.readUInt32LE(endOffset + 12);
  const centralOffset = body.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) throw new Error("zip central directory drifted");

  const records: ZipRecord[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < centralOffset; ) {
    if (offset + 30 > centralOffset || body.readUInt32LE(offset) !== 0x04034b50) {
      throw new Error("zip local header is invalid");
    }
    const flags = body.readUInt16LE(offset + 6);
    const method = body.readUInt16LE(offset + 8);
    const time = body.readUInt16LE(offset + 10);
    const date = body.readUInt16LE(offset + 12);
    const crc = body.readUInt32LE(offset + 14);
    const compressedSize = body.readUInt32LE(offset + 18);
    const size = body.readUInt32LE(offset + 22);
    const nameLength = body.readUInt16LE(offset + 26);
    const extraLength = body.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = body.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if (
      flags !== 0 ||
      method !== 8 ||
      time !== 0 ||
      date !== 0x21 ||
      extraLength !== 0 ||
      !SAFE_NAME.test(name) ||
      name === "." ||
      name === ".." ||
      seen.has(name) ||
      dataEnd > centralOffset
    ) {
      throw new Error(`invalid zip local entry: ${name || "unnamed"}`);
    }
    const contents = inflateRawSync(body.subarray(dataStart, dataEnd), {
      maxOutputLength: MAX_UNCOMPRESSED_BYTES,
    });
    if (contents.byteLength !== size || crc32(contents) !== crc) {
      throw new Error(`zip entry digest drifted: ${name}`);
    }
    records.push({
      body: Buffer.from(contents),
      compressedSize,
      crc,
      localOffset: offset,
      mode: 0o644,
      name,
    });
    seen.add(name);
    offset = dataEnd;
  }
  if (records.length !== count) throw new Error("zip local entry count drifted");

  let centralCursor = centralOffset;
  for (const record of records) {
    if (centralCursor + 46 > endOffset || body.readUInt32LE(centralCursor) !== 0x02014b50) {
      throw new Error("zip central entry is invalid");
    }
    const nameLength = body.readUInt16LE(centralCursor + 28);
    const extraLength = body.readUInt16LE(centralCursor + 30);
    const commentLength = body.readUInt16LE(centralCursor + 32);
    const nameStart = centralCursor + 46;
    const name = body.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const mode = body.readUInt32LE(centralCursor + 38) >>> 16;
    if (
      body.readUInt16LE(centralCursor + 4) !== 0x0314 ||
      body.readUInt16LE(centralCursor + 6) !== 20 ||
      body.readUInt16LE(centralCursor + 8) !== 0 ||
      body.readUInt16LE(centralCursor + 10) !== 8 ||
      body.readUInt16LE(centralCursor + 12) !== 0 ||
      body.readUInt16LE(centralCursor + 14) !== 0x21 ||
      body.readUInt32LE(centralCursor + 16) !== record.crc ||
      body.readUInt32LE(centralCursor + 20) !== record.compressedSize ||
      body.readUInt32LE(centralCursor + 24) !== record.body.byteLength ||
      extraLength !== 0 ||
      commentLength !== 0 ||
      body.readUInt16LE(centralCursor + 34) !== 0 ||
      body.readUInt16LE(centralCursor + 36) !== 0 ||
      body.readUInt32LE(centralCursor + 42) !== record.localOffset ||
      name !== record.name ||
      (mode !== 0o644 && mode !== 0o755)
    ) {
      throw new Error(`zip central metadata drifted: ${record.name}`);
    }
    record.mode = mode;
    centralCursor = nameStart + nameLength;
  }
  if (centralCursor !== endOffset) throw new Error("zip central directory has trailing data");
  const entries = records.map(({ body: contents, mode, name }) => ({ body: contents, mode, name }));
  if (!createZip(entries).equals(body)) throw new Error("zip bytes are not canonical");
  return new Map(entries.map((entry) => [entry.name, entry]));
}
