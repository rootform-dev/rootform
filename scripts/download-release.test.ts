import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  downloadRelease,
  type GitHubReleaseRequest,
  parseReleaseDownloadArguments,
} from "./download-release.ts";
import { releaseAssetNames } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const version = "0.1.0";
const releaseId = 42;
const commit = "c".repeat(40);

type RequestFixtureOptions = {
  draft?: boolean;
  extraAsset?: boolean;
  failAsset?: string;
  mismatchAsset?: string;
  tag?: string;
  target?: string;
};

function requestFixture(options: RequestFixtureOptions = {}): {
  bodies: Map<string, Buffer>;
  request: GitHubReleaseRequest;
} {
  const bodies = new Map(
    releaseAssetNames(version).map((name) => [name, Buffer.from(`canonical ${name}\n`)]),
  );
  const assets = [...bodies.entries()].map(([name, body], index) => ({
    digest: `sha256:${sha256(body)}`,
    id: 100 + index,
    name,
    size: body.byteLength,
  }));
  if (options.extraAsset) {
    assets.push({ digest: `sha256:${"0".repeat(64)}`, id: 999, name: "unexpected", size: 1 });
  }
  const request: GitHubReleaseRequest = async (url, init) => {
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-token");
    if (url.endsWith(`/releases/${releaseId}`)) {
      return Response.json({
        assets: [...assets].reverse(),
        draft: options.draft ?? false,
        id: releaseId,
        prerelease: true,
        tag_name: options.tag ?? `v${version}`,
        target_commitish: options.target ?? commit,
      });
    }
    const id = Number(url.split("/").at(-1));
    const asset = assets.find((candidate) => candidate.id === id);
    if (!asset || options.failAsset === asset.name) return new Response("failed", { status: 500 });
    const body = Buffer.from(bodies.get(asset.name) ?? "unexpected");
    if (options.mismatchAsset === asset.name) body[0] = (body[0] ?? 0) ^ 0xff;
    return new Response(new Uint8Array(body));
  };
  return { bodies, request };
}

function fixturePaths(): { metadata: string; output: string; parent: string } {
  const parent = mkdtempSync(join(tmpdir(), "rootform-release-download-"));
  return { metadata: join(parent, "release.json"), output: join(parent, "release"), parent };
}

test("downloads one exact published release and records authenticated metadata", async () => {
  const paths = fixturePaths();
  const fixture = requestFixture();
  try {
    const evidence = await downloadRelease({
      ...paths,
      releaseId,
      request: fixture.request,
      token: "test-token",
      version,
    });
    expect(evidence.target_commit).toBe(commit);
    expect(evidence.assets.map(({ name }) => name)).toEqual(releaseAssetNames(version));
    for (const [name, body] of fixture.bodies) {
      expect(readFileSync(join(paths.output, name)).equals(body)).toBe(true);
    }
    expect(JSON.parse(readFileSync(paths.metadata, "utf8"))).toEqual(evidence);
  } finally {
    rmSync(paths.parent, { force: true, recursive: true });
  }
});

test("rejects draft, wrong tag, inexact commit, and expanded releases", async () => {
  for (const options of [
    { draft: true },
    { tag: "v0.1.1" },
    { target: "dev" },
    { extraAsset: true },
  ]) {
    const paths = fixturePaths();
    try {
      await expect(
        downloadRelease({
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

test("leaves no promoted files after an asset failure or digest drift", async () => {
  const asset = releaseAssetNames(version)[0] as string;
  for (const options of [{ failAsset: asset }, { mismatchAsset: asset }]) {
    const paths = fixturePaths();
    try {
      await expect(
        downloadRelease({
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
    parseReleaseDownloadArguments(
      [
        `--version=${version}`,
        `--release-id=${releaseId}`,
        "--output=release",
        "--metadata=release.json",
      ],
      "/workspace",
    ),
  ).toEqual({
    metadata: "/workspace/release.json",
    output: "/workspace/release",
    releaseId,
    version,
  });
  expect(() => parseReleaseDownloadArguments([`--version=${version}`])).toThrow(
    "--release-id is required",
  );
});
