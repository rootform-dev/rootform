import { describe, expect, test } from "bun:test";
import { type ArchiveEntry, createTarGz, createZip, readTarGz, readZip } from "./archive.ts";

const entries: ArchiveEntry[] = [
  { body: Buffer.from("notice\n"), mode: 0o644, name: "THIRD_PARTY_NOTICES.txt" },
  { body: Buffer.from("binary"), mode: 0o755, name: "rootform" },
];

describe("canonical release archives", () => {
  test("tar gzip and ZIP are deterministic with exact modes", () => {
    const firstTar = createTarGz(entries);
    expect(firstTar).toEqual(createTarGz([...entries].reverse()));
    expect(readTarGz(firstTar).get("rootform")).toMatchObject({ mode: 0o755 });

    const firstZip = createZip(entries);
    expect(firstZip).toEqual(createZip([...entries].reverse()));
    expect(readZip(firstZip).get("rootform")).toMatchObject({ mode: 0o755 });
  });

  test("rejects duplicate, unsafe, and trailing archive data", () => {
    expect(() => createTarGz([...entries, entries[0] as ArchiveEntry])).toThrow("duplicate");
    expect(() => createZip([{ body: Buffer.from("x"), mode: 0o644, name: "../escape" }])).toThrow(
      "invalid release archive entry",
    );

    const zip = Buffer.concat([createZip(entries), Buffer.from("trailing")]);
    expect(() => readZip(zip)).toThrow();
  });
});
