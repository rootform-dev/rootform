type TokenKind = "identifier" | "string" | "heredoc" | "symbol" | "newline" | "comment";

type Token = {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
  line: number;
  endLine: number;
  lineComment?: boolean;
};

export type RfBlock = {
  kind: string;
  name: string;
  labels: string[];
  line: number;
  endLine: number;
  fields: Map<string, { value: string; line: number; endLine: number; justification: boolean }>;
  children: RfBlock[];
  parent?: RfBlock;
};

const CONTINUATION_AFTER = new Set(". , ? : = + - * / % == != < > <= >= && || =>".split(" "));
const CONTINUATION_BEFORE = new Set(". [ + - * / % ? : == != < > <= >= && || =>".split(" "));

function fail(path: string, line: number, message: string): never {
  throw new Error(`${path}:${line}: ${message}`);
}

function continuesAfter(token: Token | undefined): boolean {
  return token !== undefined && CONTINUATION_AFTER.has(token.value);
}

function continuesAcrossLine(last: Token | undefined, next: Token | undefined): boolean {
  return continuesAfter(last) || (next !== undefined && CONTINUATION_BEFORE.has(next.value));
}

function lineBreaks(value: string): number {
  return value.match(/\r\n|\r|\n/gu)?.length ?? 0;
}

function scanQuoted(source: string, start: number, line: number, path: string): number {
  for (let cursor = start + 1; cursor < source.length; ) {
    const char = source[cursor];
    if (char === '"') return cursor + 1;
    if (char === "\n" || char === "\r") fail(path, line, "newline in quoted string");
    if (char !== "\\") {
      cursor += 1;
      continue;
    }

    const escapeCode = source[cursor + 1];
    if (escapeCode === undefined) fail(path, line, "unterminated escape in quoted string");
    if ('nrt"\\'.includes(escapeCode)) {
      cursor += 2;
      continue;
    }
    if (escapeCode === "u" || escapeCode === "U") {
      const width = escapeCode === "u" ? 4 : 8;
      const digits = source.slice(cursor + 2, cursor + 2 + width);
      if (digits.length !== width || !/^[\da-f]+$/iu.test(digits)) {
        fail(path, line, "invalid Unicode escape in quoted string");
      }
      if (escapeCode === "U" && Number.parseInt(digits, 16) > 0x10ffff) {
        fail(path, line, "Unicode escape is out of range");
      }
      cursor += width + 2;
      continue;
    }
    fail(path, line, `unsupported string escape \\${escapeCode}`);
  }
  return fail(path, line, "unterminated quoted string");
}

function scanHeredoc(source: string, start: number, line: number, path: string): Token | undefined {
  const header = /^<<(-?)([A-Za-z_][A-Za-z0-9_-]*)[ \t]*(?:\r\n|\r|\n)/u.exec(source.slice(start));
  if (!header) return undefined;

  const indented = header[1] === "-";
  const marker = header[2] ?? "";
  const bodyStart = start + header[0].length;
  let cursor = bodyStart;
  let cursorLine = line + lineBreaks(header[0]);
  while (cursor <= source.length) {
    let lineEnd = cursor;
    while (lineEnd < source.length && source[lineEnd] !== "\r" && source[lineEnd] !== "\n") {
      lineEnd += 1;
    }
    const contents = source.slice(cursor, lineEnd);
    if (indented ? contents.trim() === marker : contents === marker) {
      return {
        kind: "heredoc",
        value: source.slice(start, lineEnd),
        start,
        end: lineEnd,
        line,
        endLine: cursorLine,
      };
    }
    if (lineEnd === source.length) break;
    const newlineEnd =
      source[lineEnd] === "\r" && source[lineEnd + 1] === "\n" ? lineEnd + 2 : lineEnd + 1;
    cursor = newlineEnd;
    cursorLine += 1;
  }
  return fail(path, line, `unterminated heredoc ${marker}`);
}

function tokenize(source: string, path: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  let line = 1;
  while (cursor < source.length) {
    const char = source[cursor] ?? "";
    if (char === " " || char === "\t" || char === "\f") {
      cursor += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      const start = cursor;
      if (char === "\r" && source[cursor + 1] === "\n") cursor += 2;
      else cursor += 1;
      tokens.push({ kind: "newline", value: "\n", start, end: cursor, line, endLine: line });
      line += 1;
      continue;
    }
    if (char === "#" || (char === "/" && source[cursor + 1] === "/")) {
      const start = cursor;
      const markerLength = char === "#" ? 1 : 2;
      cursor += markerLength;
      while (cursor < source.length && source[cursor] !== "\n" && source[cursor] !== "\r") {
        cursor += 1;
      }
      tokens.push({
        kind: "comment",
        value: source.slice(start + markerLength, cursor).trim(),
        start,
        end: cursor,
        line,
        endLine: line,
        lineComment: true,
      });
      continue;
    }
    if (char === "/" && source[cursor + 1] === "*") {
      const start = cursor;
      const endMarker = source.indexOf("*/", cursor + 2);
      if (endMarker < 0) fail(path, line, "unterminated block comment");
      cursor = endMarker + 2;
      const raw = source.slice(start, cursor);
      const endLine = line + lineBreaks(raw);
      tokens.push({
        kind: "comment",
        value: raw.slice(2, -2).trim(),
        start,
        end: cursor,
        line,
        endLine,
        lineComment: false,
      });
      line = endLine;
      continue;
    }
    if (char === '"') {
      const start = cursor;
      cursor = scanQuoted(source, cursor, line, path);
      tokens.push({
        kind: "string",
        value: source.slice(start, cursor),
        start,
        end: cursor,
        line,
        endLine: line,
      });
      continue;
    }
    if (char === "'") fail(path, line, "single-quoted strings are unsupported");
    if (char === "<" && source[cursor + 1] === "<") {
      const heredoc = scanHeredoc(source, cursor, line, path);
      if (!heredoc) fail(path, line, "malformed heredoc or unsupported << operator");
      tokens.push(heredoc);
      cursor = heredoc.end;
      line = heredoc.endLine;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const start = cursor;
      cursor += 1;
      while (cursor < source.length && /[A-Za-z0-9_-]/u.test(source[cursor] ?? "")) cursor += 1;
      tokens.push({
        kind: "identifier",
        value: source.slice(start, cursor),
        start,
        end: cursor,
        line,
        endLine: line,
      });
      continue;
    }

    const start = cursor;
    const operator = ["...", "==", "!=", "<=", ">=", "&&", "||", "=>"].find((candidate) =>
      source.startsWith(candidate, cursor),
    );
    const symbol = operator ?? source.slice(start, start + 1);
    if (!operator && !/[0-9]/u.test(symbol) && !"(){}[],.:=?+-*/%!<>&|^;".includes(symbol)) {
      fail(path, line, `unsupported source character ${JSON.stringify(symbol)}`);
    }
    cursor += operator?.length ?? 1;
    tokens.push({
      kind: "symbol",
      value: operator ?? source.slice(start, cursor),
      start,
      end: cursor,
      line,
      endLine: line,
    });
  }
  return tokens;
}

function decodeQuoted(raw: string): string | undefined {
  let result = "";
  for (let cursor = 1; cursor < raw.length - 1; ) {
    const char = raw[cursor] ?? "";
    if (char === "\\") {
      const escapeCode = raw[cursor + 1] ?? "";
      if (escapeCode === "n") result += "\n";
      else if (escapeCode === "r") result += "\r";
      else if (escapeCode === "t") result += "\t";
      else if (escapeCode === '"' || escapeCode === "\\") result += escapeCode;
      else if (escapeCode === "u" || escapeCode === "U") {
        const width = escapeCode === "u" ? 4 : 8;
        const point = Number.parseInt(raw.slice(cursor + 2, cursor + 2 + width), 16);
        if (!Number.isFinite(point) || point > 0x10ffff) return undefined;
        result += String.fromCodePoint(point);
        cursor += width + 2;
        continue;
      } else return undefined;
      cursor += 2;
      continue;
    }
    if ((char === "$" || char === "%") && raw[cursor + 1] === char && raw[cursor + 2] === "{") {
      result += `${char}{`;
      cursor += 3;
      continue;
    }
    if ((char === "$" || char === "%") && raw[cursor + 1] === "{") return undefined;
    result += char;
    cursor += 1;
  }
  return result;
}

function decodeHeredoc(raw: string): string | undefined {
  const header = /^<<(-?)([A-Za-z_][A-Za-z0-9_-]*)[ \t]*(?:\r\n|\r|\n)/u.exec(raw);
  if (!header) return undefined;
  const indented = header[1] === "-";
  const marker = header[2] ?? "";
  const bodyStart = header[0].length;
  const delimiterStart = raw.lastIndexOf(marker);
  if (delimiterStart < bodyStart) return undefined;
  const lineFeed = raw.lastIndexOf("\n", delimiterStart - 1);
  const carriageReturn = raw.lastIndexOf("\r", delimiterStart - 1);
  const previousBreak = Math.max(lineFeed, carriageReturn);
  const delimiterLineStart = previousBreak < bodyStart ? bodyStart : previousBreak + 1;
  let body = raw.slice(bodyStart, delimiterLineStart);
  if (indented) {
    const lines = body.split(/\r\n|\r|\n/u);
    const indentation = lines
      .filter((entry) => entry.trim() !== "")
      .map((entry) => entry.length - entry.trimStart().length)
      .reduce((minimum, amount) => Math.min(minimum, amount), Number.POSITIVE_INFINITY);
    if (Number.isFinite(indentation) && indentation > 0) {
      body = lines.map((entry) => entry.slice(Math.min(indentation, entry.length))).join("\n");
    }
  }
  if (hasTemplate(body)) return undefined;
  return body;
}

function hasTemplate(value: string): boolean {
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    const char = value[cursor];
    if ((char === "$" || char === "%") && value[cursor + 1] === char && value[cursor + 2] === "{") {
      cursor += 2;
      continue;
    }
    if ((char === "$" || char === "%") && value[cursor + 1] === "{") return true;
  }
  return false;
}

export function staticString(value: string): string | undefined {
  let tokens: Token[];
  try {
    tokens = tokenize(value.trim(), "<string>");
  } catch {
    return undefined;
  }
  if (tokens.length !== 1) return undefined;
  const token = tokens[0];
  if (token?.kind === "string") return decodeQuoted(token.value);
  if (token?.kind === "heredoc") return decodeHeredoc(token.value);
  return undefined;
}

type BlockHeader = { kind: Token; labels: Token[]; openIndex: number };

class SourceParser {
  private readonly tokens: Token[];
  private cursor = 0;

  constructor(
    private readonly source: string,
    private readonly path: string,
  ) {
    this.tokens = tokenize(source, path);
  }

  parse(): RfBlock[] {
    const roots: RfBlock[] = [];
    this.parseBody(undefined, roots, false);
    return roots;
  }

  private skipTrivia(index: number): number {
    let cursor = index;
    while (this.tokens[cursor]?.kind === "newline" || this.tokens[cursor]?.kind === "comment") {
      cursor += 1;
    }
    return cursor;
  }

  private blockHeaderAt(index: number): BlockHeader | undefined {
    const kind = this.tokens[index];
    if (kind?.kind !== "identifier") return undefined;
    let cursor = this.skipTrivia(index + 1);
    const labels: Token[] = [];
    while (this.tokens[cursor]?.kind === "string") {
      labels.push(this.tokens[cursor] as Token);
      cursor = this.skipTrivia(cursor + 1);
    }
    if (this.tokens[cursor]?.value !== "{") return undefined;
    return { kind, labels, openIndex: cursor };
  }

  private assignmentAt(index: number): boolean {
    return this.tokens[index]?.kind === "identifier" && this.tokens[index + 1]?.value === "=";
  }

  private startsStatement(index: number): boolean {
    return this.assignmentAt(index) || this.blockHeaderAt(index) !== undefined;
  }

  private parseBody(parent: RfBlock | undefined, roots: RfBlock[], expectsClose: boolean): void {
    let pendingComment: Token | undefined;
    let lastStatementEndLine = parent?.line ?? 0;

    while (this.cursor < this.tokens.length) {
      const token = this.tokens[this.cursor];
      if (!token) break;
      if (token.kind === "newline") {
        this.cursor += 1;
        continue;
      }
      if (token.kind === "comment") {
        this.cursor += 1;
        if (token.line <= lastStatementEndLine) pendingComment = undefined;
        else if (pendingComment && token.line > pendingComment.endLine + 1)
          pendingComment = undefined;
        if (token.line > lastStatementEndLine) pendingComment = token;
        continue;
      }
      if (token.value === "}") {
        if (!expectsClose) fail(this.path, token.line, "unexpected block close");
        this.cursor += 1;
        if (parent) parent.endLine = token.line;
        return;
      }

      const header = this.blockHeaderAt(this.cursor);
      if (header) {
        pendingComment = undefined;
        const labels = header.labels.map((label) => {
          const value = decodeQuoted(label.value);
          if (value === undefined)
            fail(this.path, label.line, "dynamic block labels are unsupported");
          return value;
        });
        const block: RfBlock = {
          kind: header.kind.value,
          name: labels[0] ?? "",
          labels,
          line: header.kind.line,
          endLine: header.kind.line,
          fields: new Map(),
          children: [],
          ...(parent ? { parent } : {}),
        };
        this.cursor = header.openIndex + 1;
        this.parseBody(block, [], true);
        if (parent) parent.children.push(block);
        else roots.push(block);
        lastStatementEndLine = block.endLine;
        continue;
      }

      if (this.assignmentAt(this.cursor)) {
        if (!parent) fail(this.path, token.line, "root-level attributes have no RfBlock owner");
        const key = token.value;
        const justification =
          (key === "external" || key === "disclose") &&
          pendingComment !== undefined &&
          token.line === pendingComment.endLine + 1 &&
          pendingComment.value.length >= 20;
        pendingComment = undefined;
        const field = this.parseField(token, justification);
        if (parent.fields.has(key)) fail(this.path, token.line, `duplicate attribute ${key}`);
        parent.fields.set(key, field);
        lastStatementEndLine = field.endLine;
        continue;
      }

      if (token.value === ";")
        fail(this.path, token.line, "semicolon statement separators are unsupported");
      fail(
        this.path,
        token.line,
        `unsupported source statement near ${JSON.stringify(token.value)}`,
      );
    }

    if (expectsClose && parent) fail(this.path, parent.line, "unclosed block");
  }

  private parseField(
    key: Token,
    justification: boolean,
  ): {
    value: string;
    line: number;
    endLine: number;
    justification: boolean;
  } {
    // Preserve expressions verbatim; only delimiters and statement boundaries are structural.
    this.cursor += 2;
    while (
      this.tokens[this.cursor]?.kind === "newline" ||
      this.tokens[this.cursor]?.kind === "comment"
    ) {
      this.cursor += 1;
    }
    const first = this.tokens[this.cursor];
    if (!first || first.value === "}" || first.value === ";") {
      fail(this.path, key.line, `attribute ${key.value} requires an expression`);
    }

    const delimiters: Token[] = [];
    let last: Token | undefined;
    while (this.cursor < this.tokens.length) {
      const token = this.tokens[this.cursor];
      if (!token) break;
      if (token.kind === "newline") {
        if (
          delimiters.length > 0 ||
          continuesAcrossLine(last, this.tokens[this.skipTrivia(this.cursor + 1)])
        ) {
          this.cursor += 1;
          continue;
        }
        break;
      }
      if (token.kind === "comment" && delimiters.length === 0 && token.lineComment !== false) {
        if (continuesAfter(last)) {
          this.cursor += 1;
          continue;
        }
        break;
      }
      if (token.kind === "comment" && delimiters.length === 0) {
        this.cursor += 1;
        continue;
      }
      if (token.value === ";")
        fail(this.path, token.line, "semicolon expression separators are unsupported");
      if (delimiters.length === 0 && last && this.startsStatement(this.cursor)) break;

      if (token.value === "(" || token.value === "[" || token.value === "{") {
        delimiters.push(token);
      } else if (token.value === ")" || token.value === "]" || token.value === "}") {
        if (delimiters.length === 0) {
          if (token.value === "}") break;
          fail(this.path, token.line, `unexpected closing delimiter ${token.value}`);
        }
        const open = delimiters.at(-1);
        const expected = open?.value === "(" ? ")" : open?.value === "[" ? "]" : "}";
        if (token.value !== expected) {
          fail(
            this.path,
            token.line,
            `closing delimiter ${token.value} does not match ${open?.value}`,
          );
        }
        delimiters.pop();
      }
      last = token;
      this.cursor += 1;
    }

    if (!last) fail(this.path, key.line, `attribute ${key.value} requires an expression`);
    if (delimiters.length > 0) {
      const open = delimiters.at(-1);
      fail(this.path, open?.line ?? key.line, `unclosed expression delimiter ${open?.value ?? ""}`);
    }
    return {
      value: this.source.slice(first.start, last.end).trim(),
      line: key.line,
      endLine: last.endLine,
      justification,
    };
  }
}

export function parseRfSource(text: string, path = "<source>"): RfBlock[] {
  return new SourceParser(text, path).parse();
}

export function flattenRfBlocks(roots: RfBlock[]): RfBlock[] {
  const blocks: RfBlock[] = [];
  const visit = (block: RfBlock): void => {
    blocks.push(block);
    for (const child of block.children) visit(child);
  };
  for (const root of roots) visit(root);
  return blocks;
}

export function referencePaths(expression: string): string[] {
  const tokens = tokenize(expression, "<expression>");
  const significantBefore = (index: number): number => {
    let cursor = index - 1;
    while (
      cursor >= 0 &&
      (tokens[cursor]?.kind === "newline" || tokens[cursor]?.kind === "comment")
    ) {
      cursor -= 1;
    }
    return cursor;
  };
  const significantAfter = (index: number): number => {
    let cursor = index + 1;
    while (tokens[cursor]?.kind === "newline" || tokens[cursor]?.kind === "comment") cursor += 1;
    return cursor;
  };

  const paths = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "identifier") continue;
    const previous = tokens[significantBefore(index)];
    if (previous?.value === ".") continue;
    let path = token.value;
    let cursor = index;
    while (true) {
      const dotIndex = significantAfter(cursor);
      const memberIndex = significantAfter(dotIndex);
      if (tokens[dotIndex]?.value !== "." || tokens[memberIndex]?.kind !== "identifier") break;
      path += `.${tokens[memberIndex]?.value ?? ""}`;
      cursor = memberIndex;
    }
    if (path.includes(".")) paths.add(path);
  }
  return [...paths];
}
