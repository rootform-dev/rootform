import { createHash } from "node:crypto";

// Exact theme bootstrap from renderer-d37f2b47694e2970ad08f5559103ea6f51c11b49.
const themeInitializer = "543747a4c1e289b0e09c931ddd0566c45178ede2f3f08e0d3f5443ec7f4f42c4";

export function explorerModuleEntrypoint(html: string): string {
  const modules = [...html.matchAll(/<script\b([^>]*)>/giu)].filter(([, attributes = ""]) =>
    /\btype\s*=\s*["']module["']/iu.test(attributes),
  );
  const source = modules[0]?.[1]?.match(/\bsrc\s*=\s*["']([^"']+)["']/iu)?.[1];
  if (modules.length !== 1 || !source) throw new Error("Explorer module entry inventory drifted");
  return source;
}

export function assertExportScripts(html: string): void {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/giu)];
  if ((html.match(/<script\b/giu) ?? []).length !== scripts.length)
    throw new Error("HTML export contains an unterminated script");
  const data = new Set<string>();
  let modules = 0;
  let themes = 0;
  for (const [, attributes = "", body = ""] of scripts) {
    if (/\bsrc\s*=/iu.test(attributes))
      throw new Error("HTML export references an external script");
    const type = attributes.match(/\btype=["']([^"']+)["']/iu)?.[1] ?? "";
    const id = attributes.match(/\bid=["']([^"']+)["']/iu)?.[1] ?? "";
    if (type === "application/json") {
      if (!["rootform-document", "rootform-presentation"].includes(id) || data.has(id))
        throw new Error("HTML export JSON script inventory drifted");
      if (JSON.parse(body) === null) throw new Error("HTML export contains an empty payload");
      data.add(id);
    } else if (type === "module" && !id && body.trim()) {
      modules++;
    } else if (
      !type &&
      !id &&
      createHash("sha256").update(body).digest("hex") === themeInitializer
    ) {
      themes++;
    } else {
      throw new Error("HTML export contains an unexpected script");
    }
  }
  if (data.size !== 2 || modules !== 1 || themes > 1)
    throw new Error("HTML export script inventory drifted");
}

type ModuleResponse = { body: string; contentType: string };

export async function readLocalModuleGraph(
  entry: URL,
  load: (url: URL) => Promise<ModuleResponse>,
): Promise<Map<string, string>> {
  const modules = new Map<string, string>();
  const pending = [entry];
  while (pending.length) {
    const url = pending.shift();
    if (!url || modules.has(url.href)) continue;
    if (
      url.origin !== entry.origin ||
      !url.pathname.startsWith("/assets/") ||
      !url.pathname.endsWith(".js") ||
      url.search ||
      url.hash ||
      modules.size >= 64
    )
      throw new Error("Explorer module graph contains an invalid asset identity");
    const response = await load(url);
    if (!response.contentType.startsWith("text/javascript") || response.body.length > 4_194_304)
      throw new Error("Explorer module asset is not bounded JavaScript");
    modules.set(url.href, response.body);
    const imports = [
      ...response.body.matchAll(/\b(?:import|export)[^;]*?\bfrom\s*["']([^"']+)["']/gu),
      ...response.body.matchAll(/\bimport\s*(?:\(\s*)?["']([^"']+)["']/gu),
      ...response.body.matchAll(/["'`]((?:\.\.?\/|\/assets\/|assets\/)[^"'`\s]+\.js)["'`]/gu),
    ];
    for (const match of imports) {
      const reference = match[1] ?? "";
      if (/^(?:https?:|\/\/)/u.test(reference))
        throw new Error("Explorer module imports a remote resource");
      const target = new URL(reference.startsWith("assets/") ? `/${reference}` : reference, url);
      pending.push(target);
    }
  }
  return modules;
}
