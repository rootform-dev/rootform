import { expect, test } from "bun:test";
import {
  assertExportScripts,
  explorerModuleEntrypoint,
  readLocalModuleGraph,
} from "./renderer-runtime-proof.ts";

test("Explorer chooses its module graph after an independent theme bootstrap", () => {
  for (const module of [
    '<script type="module" src="/assets/main.js"></script>',
    '<script src="/assets/main.js" crossorigin type="module"></script>',
  ])
    expect(explorerModuleEntrypoint('<script src="/assets/theme.js"></script>' + module)).toBe(
      "/assets/main.js",
    );
  expect(() => explorerModuleEntrypoint('<script src="/assets/theme.js"></script>')).toThrow();
  expect(() =>
    explorerModuleEntrypoint(
      '<script type="module" src="/assets/first.js"></script><script type="module" src="/assets/second.js"></script>',
    ),
  ).toThrow();
});

const payloads =
  '<script id="rootform-document" type="application/json">{}</script>' +
  '<script id="rootform-presentation" type="application/json">{}</script>';

test("HTML proof rejects extra executable scripts and missing or duplicate data", () => {
  const valid = `<script type="module">void 0</script>${payloads}`;
  expect(() => assertExportScripts(valid)).not.toThrow();
  for (const html of [
    `${valid}<script>fetch("https://example.invalid")</script>`,
    `${valid}<script type="module">void 1</script>`,
    `${valid}${payloads}`,
    valid.replace('type="module"', 'type="module" src="/client.js"'),
    valid.replace("{}</script>", "null</script>"),
    valid.replace('id="rootform-document"', 'id="unrelated"'),
    `${valid}<script>`,
  ])
    expect(() => assertExportScripts(html)).toThrow();
});

test("HTML proof accounts for script end tags accepted by browsers", () => {
  const valid = `<script type="module">void 0</script>${payloads}`;
  for (const end of ["</script >", "</script\n>", '</script data-fictional="value">']) {
    expect(() => assertExportScripts(valid.replaceAll("</script>", end))).not.toThrow();
    expect(() => assertExportScripts(`${valid}<script>void 1${end}`)).toThrow();
  }
});

test("Explorer proof follows split modules and cycles once", async () => {
  const visited: string[] = [];
  const graph = await readLocalModuleGraph(
    new URL("http://127.0.0.1:4351/assets/main.js"),
    async (url) => {
      visited.push(url.pathname);
      return {
        contentType: "text/javascript",
        body:
          url.pathname === "/assets/main.js"
            ? 'import { x } from "./document.js"; import("./document.js");'
            : 'export { x } from "./main.js";',
      };
    },
  );
  expect(graph.size).toBe(2);
  expect(visited).toEqual(["/assets/main.js", "/assets/document.js"]);
});

test("Explorer proof refuses remote imports and paths outside its asset closure", async () => {
  for (const reference of [
    "https://example.invalid/client.js",
    "//example.invalid/client.js",
    "../../private.js",
  ])
    await expect(
      readLocalModuleGraph(new URL("http://127.0.0.1:4351/assets/main.js"), async () => ({
        contentType: "text/javascript",
        body: `import("${reference}");`,
      })),
    ).rejects.toThrow();
});

test("Explorer proof rejects wrong MIME types and unbounded module graphs", async () => {
  const entry = new URL("http://127.0.0.1:4351/assets/0.js");
  await expect(
    readLocalModuleGraph(entry, async () => ({ body: "", contentType: "text/html" })),
  ).rejects.toThrow();
  await expect(
    readLocalModuleGraph(entry, async (url) => ({
      contentType: "text/javascript",
      body: `import("./${Number(url.pathname.split("/").at(-1)?.replace(".js", "")) + 1}.js");`,
    })),
  ).rejects.toThrow();
});
