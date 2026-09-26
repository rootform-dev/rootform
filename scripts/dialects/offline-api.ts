#!/usr/bin/env bun

// Loopback stand-in for the provider APIs a few Terraform providers call while
// they configure themselves: Okta checks its API token, Snowflake opens a
// session and runs trivial queries, and HCP exchanges client credentials for a
// token and reads the configured project. The offline plan generator starts
// this beside the sandboxed "terraform plan" and points those providers at it.
// It answers only those calls, with placeholder values, and refuses every
// other request, so a provider that starts calling something new fails the
// plan instead of passing unnoticed.
//
//   bun scripts/dialects/offline-api.ts <http-port> [<https-port> <certificate> <key>]

const PLACEHOLDER_ORGANIZATION = "00000000-0000-0000-0000-000000000001";

type Answer = { status: number; body: unknown };

function refuse(request: Request, path: string): Answer {
  process.stderr.write(`offline API stand-in refused ${request.method} ${path}\n`);
  return { status: 404, body: { message: "not answered offline", success: false } };
}

function snowflakeQuery(sql: string): Answer | undefined {
  const text = sql.trim();
  let column: string;
  let value: string;
  let type: "fixed" | "text";
  if (/^select 1$/iu.test(text)) {
    column = "1";
    value = "1";
    type = "fixed";
  } else {
    const match = /^select\s+current_[a-z_]+\(\)\s+as\s+([a-z_]+)$/iu.exec(text);
    if (!match?.[1]) return undefined;
    column = match[1].toUpperCase();
    value = "FIXTURE";
    type = "text";
  }
  const rowtype = [
    {
      name: column,
      database: "",
      schema: "",
      table: "",
      type,
      nullable: true,
      length: type === "text" ? 16777216 : null,
      byteLength: type === "text" ? 16777216 : null,
      precision: type === "fixed" ? 1 : null,
      scale: type === "fixed" ? 0 : null,
    },
  ];
  return {
    status: 200,
    body: {
      data: {
        parameters: [],
        rowtype,
        rowset: [[value]],
        total: 1,
        returned: 1,
        queryId: "fixture-query",
        queryResultFormat: "json",
        finalRoleName: "FIXTURE",
        numberOfBinds: 0,
        statementTypeId: 4096,
        version: 1,
      },
      message: null,
      code: null,
      success: true,
    },
  };
}

async function answer(request: Request): Promise<Answer> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && path === "/.rootform/ready") return { status: 200, body: {} };
  // Okta: the provider validates its API token by reading the calling user.
  if (request.method === "GET" && path === "/api/v1/users/me") {
    return {
      status: 200,
      body: {
        id: "00ufixture",
        status: "ACTIVE",
        profile: { login: "fixture@example.invalid", email: "fixture@example.invalid" },
      },
    };
  }
  // Snowflake: login, then the session checks the provider runs.
  if (request.method === "POST" && path === "/session/v1/login-request") {
    return {
      status: 200,
      body: {
        data: {
          masterToken: "fixture-master",
          token: "fixture-session",
          validityInSeconds: 3600,
          masterValidityInSeconds: 14400,
          displayUserName: "FIXTURE",
          serverVersion: "9.0.0",
          firstLogin: false,
          healthCheckInterval: 45,
          sessionId: 1,
          parameters: [],
          sessionInfo: { roleName: "FIXTURE" },
        },
        message: null,
        code: null,
        success: true,
      },
    };
  }
  if (request.method === "POST" && path === "/queries/v1/query-request") {
    const { sqlText } = (await request.json()) as { sqlText?: string };
    return snowflakeQuery(sqlText ?? "") ?? refuse(request, `${path} (query)`);
  }
  if (request.method === "POST" && path === "/session") {
    return { status: 200, body: { data: null, message: null, code: null, success: true } };
  }
  // HCP: client credentials exchange, then the configured project.
  if (request.method === "POST" && path === "/oauth2/token") {
    return {
      status: 200,
      body: { access_token: "fixture-access-token", token_type: "bearer", expires_in: 3600 },
    };
  }
  const project = /^\/resource-manager\/2019-12-10\/projects\/([0-9a-f-]+)$/u.exec(path);
  if (request.method === "GET" && project?.[1]) {
    return {
      status: 200,
      body: {
        project: {
          id: project[1],
          name: "fixture",
          description: "",
          parent: { type: "ORGANIZATION", id: PLACEHOLDER_ORGANIZATION },
          state: "ACTIVE",
          created_at: "2026-01-01T00:00:00Z",
        },
      },
    };
  }
  return refuse(request, path);
}

async function handle(request: Request): Promise<Response> {
  const { status, body } = await answer(request);
  return Response.json(body, { status });
}

if (import.meta.main) {
  const [httpPort, httpsPort, certificate, key] = process.argv.slice(2);
  if (!httpPort)
    throw new Error("usage: offline-api.ts <http-port> [<https-port> <certificate> <key>]");
  Bun.serve({ hostname: "127.0.0.1", port: Number(httpPort), fetch: handle });
  if (httpsPort && certificate && key) {
    Bun.serve({
      hostname: "127.0.0.1",
      port: Number(httpsPort),
      tls: { cert: Bun.file(certificate), key: Bun.file(key) },
      fetch: handle,
    });
  }
}
