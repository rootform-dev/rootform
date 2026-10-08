import { createHash } from "node:crypto";

const SAFE_NAME = /^[A-Za-z0-9._-]+$/u;

export function sha256(body: Uint8Array | string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function checksumFile(
  files: ReadonlyArray<{ body: Uint8Array | string; name: string }>,
): string {
  if (files.length === 0) throw new Error("checksum inventory is empty");
  const seen = new Set<string>();
  return `${[...files]
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map(({ body, name }) => {
      if (!SAFE_NAME.test(name) || name === "." || name === ".." || seen.has(name)) {
        throw new Error(`invalid checksum name: ${name}`);
      }
      seen.add(name);
      return `${sha256(body)}  ${name}`;
    })
    .join("\n")}\n`;
}

export function parseChecksumFile(body: string): Map<string, string> {
  if (!body.endsWith("\n")) throw new Error("checksum file must end with newline");
  const records = new Map<string, string>();
  for (const line of body.slice(0, -1).split("\n")) {
    const match = line.match(/^([0-9a-f]{64}) {2}([A-Za-z0-9._-]+)$/u);
    if (
      !match?.[1] ||
      !match[2] ||
      match[2] === "." ||
      match[2] === ".." ||
      records.has(match[2])
    ) {
      throw new Error("invalid checksum record");
    }
    records.set(match[2], match[1]);
  }
  if (records.size === 0) throw new Error("checksum inventory is empty");
  const canonical = [...records.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([name, digest]) => `${digest}  ${name}`)
    .join("\n");
  if (`${canonical}\n` !== body) throw new Error("checksum records are not canonical");
  return records;
}
