#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeVersion } from "./release/contract.ts";

const values = new Map<string, string>();
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
  const name = args[index];
  const value = args[index + 1];
  if (
    !name ||
    !["--binary", "--browser", "--version", "--evidence"].includes(name) ||
    !value ||
    values.has(name)
  )
    throw new Error("Invalid browser qualification arguments");
  values.set(name, value);
}
const binary = resolve(values.get("--binary") ?? "");
const browser = resolve(values.get("--browser") ?? "");
const version = normalizeVersion(values.get("--version") ?? "");
const evidence = values.get("--evidence");
if (!existsSync(binary) || !existsSync(browser) || !evidence)
  throw new Error("Browser qualification requires executable inputs and an evidence path");
const root = resolve(import.meta.dir, "..");
const work = mkdtempSync(join(tmpdir(), "rootform-browser-"));
const env: Record<string, string> = {
  HOME: work,
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  ROOTFORM_HOME: join(work, "home"),
  ROOTFORM_OFFLINE: "1",
  LANG: "en_US.UTF-8",
};
for (const name of ["SystemRoot", "WINDIR", "TMPDIR", "TMP", "TEMP"])
  if (process.env[name]) env[name] = process.env[name] as string;
const run = (command: string[]) => {
  const outcome = Bun.spawnSync([binary, ...command], {
    env,
    cwd: work,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (outcome.exitCode !== 0) throw new Error("Qualification executable command failed");
  return outcome.stdout.toString();
};
async function address(stream: ReadableStream<Uint8Array>, pattern: RegExp): Promise<string> {
  const reader = stream.getReader();
  let body = "";
  const timer = setTimeout(() => reader.cancel(), 20_000);
  try {
    while (true) {
      const next = await reader.read();
      body += next.value ? new TextDecoder().decode(next.value) : "";
      if (body.length > 65_536) throw new Error("Qualification startup output exceeded its bound");
      const match = body.match(pattern);
      if (match?.[0]) return match[0];
      if (next.done) throw new Error("Qualification process did not start");
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

let explorer: ReturnType<typeof Bun.spawn> | undefined;
let chrome: ReturnType<typeof Bun.spawn> | undefined;
let socket: WebSocket | undefined;
const drains: Promise<void>[] = [];
const discard = (stream: ReadableStream<Uint8Array>) => {
  drains.push(stream.pipeTo(new WritableStream<Uint8Array>({ write() {} })));
};
try {
  if (run(["version"]).trim() !== `rootform ${version}`)
    throw new Error("Qualification binary version mismatch");
  const input = join(root, "examples/playground/shared-data-platform/base");
  const form = join(work, "form.json");
  run([
    "run",
    join(input, "plan.json"),
    "--project",
    input,
    "--plan-file",
    join(input, "plan.tfplan"),
    "--require-enrichment",
    "--locked",
    "--no-serve",
    "-o",
    form,
  ]);
  const html = join(work, "form.html");
  run(["run", form, "--no-serve", "-o", html]);
  explorer = Bun.spawn([binary, "run", form, "--no-browser", "--port", "0"], {
    env,
    cwd: work,
    stdout: "ignore",
    stderr: "pipe",
  });
  const live = await address(
    explorer.stderr as ReadableStream<Uint8Array>,
    /http:\/\/127\.0\.0\.1:[0-9]{1,5}/u,
  );
  discard(explorer.stderr as ReadableStream<Uint8Array>);
  chrome = Bun.spawn(
    [
      browser,
      "--headless=new",
      "--no-sandbox",
      "--password-store=basic",
      "--use-mock-keychain",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${join(work, "browser")}`,
      "about:blank",
    ],
    { env, cwd: work, stdout: "ignore", stderr: "pipe" },
  );
  const debuggerUrl = await address(
    chrome.stderr as ReadableStream<Uint8Array>,
    /ws:\/\/127\.0\.0\.1:[0-9]+\/devtools\/browser\/[a-zA-Z0-9-]+/u,
  );
  discard(chrome.stderr as ReadableStream<Uint8Array>);
  socket = new WebSocket(debuggerUrl);
  const connected = socket;
  await new Promise<void>((ok, fail) => {
    connected.addEventListener("open", () => ok(), { once: true });
    connected.addEventListener(
      "error",
      () => fail(new Error("Browser debugging connection failed")),
      { once: true },
    );
  });
  let serial = 0;
  const pending = new Map<
    number,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const requests = new Map<string, string[]>();
  const responses = new Map<string, Map<string, number>>();
  const failures = new Map<string, number>();
  connected.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const promise = pending.get(message.id);
      if (!promise) return;
      clearTimeout(promise.timer);
      pending.delete(message.id);
      if (message.error) promise.reject(new Error("Browser protocol command failed"));
      else promise.resolve(message.result ?? {});
    } else if (message.sessionId) {
      if (message.method === "Network.requestWillBeSent")
        requests.get(message.sessionId)?.push(message.params.request.url);
      if (message.method === "Network.responseReceived")
        responses
          .get(message.sessionId)
          ?.set(message.params.response.url, message.params.response.status);
      if (message.method === "Runtime.exceptionThrown")
        failures.set(message.sessionId, (failures.get(message.sessionId) ?? 0) + 1);
    }
  });
  const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<Record<string, unknown>>((ok, fail) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        fail(new Error(`Browser protocol command timed out: ${method}`));
      }, 15_000);
      pending.set(id, { resolve: ok, reject: fail, timer });
      connected.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const inspect = async (url: string, offline: boolean) => {
    const target = await send("Target.createTarget", { url: "about:blank" });
    const attached = await send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true,
    });
    const session = String(attached.sessionId);
    requests.set(session, []);
    responses.set(session, new Map());
    failures.set(session, 0);
    await send("Network.enable", {}, session);
    await send("Runtime.enable", {}, session);
    await send("Page.enable", {}, session);
    await send("Page.navigate", { url }, session);
    let rendered = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await send(
        "Runtime.evaluate",
        {
          expression:
            "Boolean(document.querySelector('[data-rootform-renderer][data-render-state=ready][aria-busy=false] .xnode[data-explorer-node]'))",
          returnByValue: true,
        },
        session,
      );
      const dataReceived =
        offline ||
        ["/api/v1/document", "/api/v1/presentation"].every((endpoint) =>
          [...(responses.get(session)?.entries() ?? [])].some(
            ([address, status]) => status === 200 && new URL(address).pathname === endpoint,
          ),
        );
      if ((result.result as { value?: boolean })?.value && dataReceived) {
        rendered = true;
        break;
      }
      await new Promise((ok) => setTimeout(ok, 100));
    }
    if (!rendered || failures.get(session))
      throw new Error("Explorer did not render without runtime errors");
    await new Promise((ok) => setTimeout(ok, 250));
    if (failures.get(session)) throw new Error("Explorer reported a runtime error after rendering");
    const urls = requests.get(session) ?? [];
    const http = urls.filter((item) => /^https?:/u.test(item));
    if (offline) {
      if (http.length) throw new Error("Self-contained export used the network");
    } else {
      if (http.some((item) => new URL(item).origin !== new URL(url).origin))
        throw new Error("Explorer requested an external resource");
      for (const endpoint of ["/api/v1/document", "/api/v1/presentation"])
        if (!http.some((item) => new URL(item).pathname === endpoint))
          throw new Error("Explorer did not request its product data");
    }
    const observation = {
      mode: offline ? "self-contained-html" : "live-explorer",
      http_requests: http.length,
      data_responses: offline
        ? []
        : [...(responses.get(session)?.entries() ?? [])]
            .filter(([address]) => new URL(address).pathname.startsWith("/api/v1/"))
            .map(([address, status]) => ({ path: new URL(address).pathname, status })),
      runtime_errors: failures.get(session) ?? 0,
    };
    await send("Target.closeTarget", { targetId: target.targetId });
    return observation;
  };
  const browserIdentity = await send("Browser.getVersion");
  const liveObservation = await inspect(live, false);
  const offlineObservation = await inspect(pathToFileURL(html).href, true);
  const proof = {
    format_version: "1",
    version,
    binary_sha256: createHash("sha256").update(readFileSync(binary)).digest("hex"),
    browser: String(browserIdentity.product ?? ""),
    browser_protocol: String(browserIdentity.protocolVersion ?? ""),
    form_sha256: createHash("sha256").update(readFileSync(form)).digest("hex"),
    html_sha256: createHash("sha256").update(readFileSync(html)).digest("hex"),
    observed_at: new Date().toISOString(),
    observations: [liveObservation, offlineObservation],
    live_explorer_rendered: true,
    actual_document_and_presentation_requests: true,
    external_network_requests: 0,
    runtime_errors: 0,
    offline_html_rendered: true,
    offline_http_requests: 0,
  };
  mkdirSync(dirname(resolve(evidence)), { recursive: true });
  writeFileSync(evidence, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof));
} finally {
  socket?.close();
  for (const process of [explorer, chrome]) {
    if (!process || process.exitCode !== null) continue;
    process.kill("SIGTERM");
    const timer = setTimeout(() => process.kill("SIGKILL"), 5000);
    try {
      await process.exited;
    } finally {
      clearTimeout(timer);
    }
  }
  await Promise.allSettled(drains);
  rmSync(work, { force: true, recursive: true });
}
