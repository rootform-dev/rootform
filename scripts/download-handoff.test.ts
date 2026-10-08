import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadHandoff, type GitHubRequest, parseDownloadArguments } from "./download-handoff.ts";
import { handoffBundleName } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const version = "0.1.0-dev.2";
const releaseId = 42;

type RequestFixtureOptions = {
  draft?: boolean;
  extraAsset?: boolean;
  failAsset?: string;
  mismatchAsset?: string;
};

function requestFixture(options: RequestFixtureOptions = {}): {
  bodies: Map<string, Buffer>;
  request: GitHubRequest;
} {
  const bundleName = handoffBundleName(version);
  const bodies = new Map([
    [bundleName, Buffer.from("canonical handoff bundle")],
    ["ENGINE_HANDOFF_SHA256SUMS", Buffer.from("canonical outer checksums\n")],
  ]);
  const assets = [...bodies.entries()].map(([name, body], index) => ({
    digest: `sha256:${sha256(body)}`,
    id: 100 + index,
    name,
    size: body.byteLength,
  }));
  if (options.extraAsset) {
    assets.push({
      digest: `sha256:${"0".repeat(64)}`,
      id: 999,
      name: "unexpected.txt",
      size: 1,
    });
  }
  const request: GitHubRequest = async (url, init) => {
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-token");
    if (url.endsWith(`/releases/${releaseId}`)) {
      return Response.json({
        assets: [...assets].reverse(),
        draft: options.draft ?? true,
        id: releaseId,
      });
    }
    const id = Number(url.split("/").at(-1));
    const asset = assets.find((candidate) => candidate.id === id);
    if (!asset || options.failAsset === asset.name) return new Response("failed", { status: 500 });
    const body = bodies.get(asset.name) ?? Buffer.from("unexpected");
    const responseBody = Buffer.from(body);
    if (options.mismatchAsset === asset.name) responseBody[0] = (responseBody[0] ?? 0) ^ 0xff;
    return new Response(new Uint8Array(responseBody));
  };
  return { bodies, request };
}

function fixturePaths(): { metadata: string; output: string; parent: string } {
  const parent = mkdtempSync(join(tmpdir(), "rootform-handoff-download-"));
  return {
    metadata: join(parent, "github-assets.json"),
    output: join(parent, "handoff"),
    parent,
  };
}

test("downloads exact draft assets and writes canonical authenticated metadata", async () => {
  const paths = fixturePaths();
  const fixture = requestFixture();
  try {
    await downloadHandoff({
      ...paths,
      releaseId,
      request: fixture.request,
      token: "test-token",
      version,
    });
    for (const [name, body] of fixture.bodies) {
      expect(readFileSync(join(paths.output, name)).equals(body)).toBe(true);
    }
    const metadata = JSON.parse(readFileSync(paths.metadata, "utf8")) as {
      assets: Array<{ name: string }>;
      draft: boolean;
      release_id: number;
    };
    expect(metadata.draft).toBe(true);
    expect(metadata.release_id).toBe(releaseId);
    expect(metadata.assets.map(({ name }) => name)).toEqual([
      "ENGINE_HANDOFF_SHA256SUMS",
      handoffBundleName(version),
    ]);
  } finally {
    rmSync(paths.parent, { force: true, recursive: true });
  }
});

test("rejects published or expanded handoff releases", async () => {
  for (const options of [{ draft: false }, { extraAsset: true }]) {
    const paths = fixturePaths();
    try {
      await expect(
        downloadHandoff({
          ...paths,
          releaseId,
          request: requestFixture(options).request,
          token: "test-token",
          version,
        }),
      ).rejects.toThrow();
      expect(existsSync(paths.output)).toBe(false);
      expect(existsSync(paths.metadata)).toBe(false);
    } finally {
      rmSync(paths.parent, { force: true, recursive: true });
    }
  }
});

test("leaves no promoted files when an asset download fails or drifts", async () => {
  for (const options of [
    { failAsset: handoffBundleName(version) },
    { mismatchAsset: handoffBundleName(version) },
  ]) {
    const paths = fixturePaths();
    try {
      await expect(
        downloadHandoff({
          ...paths,
          releaseId,
          request: requestFixture(options).request,
          token: "test-token",
          version,
        }),
      ).rejects.toThrow();
      expect(existsSync(paths.output)).toBe(false);
      expect(existsSync(paths.metadata)).toBe(false);
    } finally {
      rmSync(paths.parent, { force: true, recursive: true });
    }
  }
});

test("download CLI requires exact explicit inputs", () => {
  expect(
    parseDownloadArguments(
      [
        `--version=${version}`,
        `--release-id=${releaseId}`,
        "--output=handoff",
        "--metadata=assets.json",
      ],
      "/workspace",
    ),
  ).toEqual({
    metadata: "/workspace/assets.json",
    output: "/workspace/handoff",
    releaseId,
    version,
  });
  expect(() => parseDownloadArguments([`--version=${version}`])).toThrow(
    "--release-id is required",
  );
});
