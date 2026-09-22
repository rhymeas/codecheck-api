import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  VALIDATORS,
  supportedTypes,
  completableTypes,
  completeCheckDigit,
} from "./validators";

type Env = {
  API_KEY?: string;
  RAPIDAPI_SECRET?: string;
  DEV_MODE?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

const PUBLIC_PATHS = ["/", "/v1/health", "/v1/types"];
const MAX_VALUE_LEN = 128;
const MAX_BODY_BYTES = 1_000_000;

function secretMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

app.use("/v1/*", async (c, next) => {
  if (PUBLIC_PATHS.includes(new URL(c.req.url).pathname)) return next();
  const devMode = c.env.DEV_MODE === "1";
  const keyOk = secretMatches(c.req.header("x-api-key"), c.env.API_KEY);
  const rapidOk = secretMatches(c.req.header("x-rapidapi-proxy-secret"), c.env.RAPIDAPI_SECRET);
  if (devMode || keyOk || rapidOk) return next();
  return c.json(
    {
      error: "unauthorized",
      message:
        "Provide a valid x-api-key header, or call this API through its RapidAPI listing.",
    },
    401,
  );
});

const INFO = {
  name: "codecheck-api",
  version: "0.1.0",
  description: "Deterministic identifier and checksum validation",
  endpoints: [
    "/v1/health",
    "/v1/types",
    "/v1/validate/{type}/{value}",
    "/v1/complete/{type}/{body}",
    "POST /v1/validate",
  ],
};

function landingHtml(): string {
  const rows = Object.values(VALIDATORS)
    .map((entry) => `<tr><td>${entry.type}</td><td>${entry.description}</td></tr>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CodeCheck API - identifier and checksum validation</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.6 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
         background: #0e1013; color: #d7dce3; }
  main { max-width: 760px; margin: 0 auto; padding: 56px 24px 96px; }
  h1 { font-size: 1.7rem; letter-spacing: -0.02em; margin: 0 0 4px; color: #fff; }
  h1 span { color: #6ee7a8; }
  p.lead { color: #96a0ad; margin: 0 0 32px; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.14em;
       color: #6ee7a8; margin: 40px 0 12px; font-weight: 600; }
  pre { background: #151a20; border: 1px solid #232a33; border-radius: 8px;
        padding: 16px; overflow-x: auto; font-size: 0.86rem; color: #cfe3d6; }
  code { color: #9fe8c0; }
  table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
  td { padding: 6px 10px 6px 0; border-bottom: 1px solid #1c2229; vertical-align: top; }
  td:first-child { color: #6ee7a8; white-space: nowrap; width: 1%; padding-right: 20px; }
  a { color: #6ee7a8; }
  footer { margin-top: 48px; color: #6b7480; font-size: 0.8rem; }
</style>
</head>
<body>
<main>
  <h1>CodeCheck<span>_</span></h1>
  <p class="lead">Deterministic identifier and checksum validation. Pure arithmetic:
  no data lookups, no storage, answers in milliseconds.</p>

  <h2>Try it</h2>
  <pre>curl "$HOST/v1/validate/iban/DE89370400440532013000" -H "x-api-key: $KEY"
curl "$HOST/v1/validate/gtin/4006381333932" -H "x-api-key: $KEY"
curl -X POST "$HOST/v1/validate" -H "x-api-key: $KEY" -H "content-type: application/json" \\
  -d '{"items":[{"type":"gtin","value":"4006381333931"},{"type":"vin","value":"1HGCM82633A004352"}]}'</pre>

  <h2>Generate a check digit</h2>
  <pre>curl "$HOST/v1/complete/gtin/400638133393" -H "x-api-key: $KEY"
# { "checkDigit": "1", "complete": "4006381333931", "algorithm": "GS1 mod-10 (weights 3,1)" }</pre>

  <h2>Supported types (${Object.values(VALIDATORS).length})</h2>
  <table>${rows}</table>

  <footer>Spaces, dashes and lower case are normalised. Values are never logged or stored.
  Get a key on the API's marketplace listing.</footer>
</main>
</body>
</html>`;
}

app.get("/", (c) =>
  c.req.header("accept")?.includes("text/html")
    ? c.html(landingHtml())
    : c.json(INFO),
);

app.get("/v1/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

app.get("/v1/types", (c) =>
  c.json({
    count: supportedTypes().length,
    types: Object.values(VALIDATORS).map((entry) => ({
      type: entry.type,
      description: entry.description,
      examples: entry.examples,
      completable: completableTypes().includes(entry.type),
    })),
  }),
);

app.get("/v1/validate/:type/:value", (c) => {
  const value = c.req.param("value");
  if (value.length > MAX_VALUE_LEN) {
    return c.json({ error: "value_too_long", message: `max ${MAX_VALUE_LEN} characters` }, 413);
  }
  const type = c.req.param("type").toLowerCase();
  const entry = VALIDATORS[type];
  if (!entry) {
    return c.json(
      { error: "unsupported_type", message: `unknown type '${type}'`, supported: supportedTypes() },
      400,
    );
  }
  return c.json(entry.validate(value));
});

app.get("/v1/complete/:type/:body", (c) => {
  const body = c.req.param("body");
  if (body.length > MAX_VALUE_LEN) {
    return c.json({ error: "value_too_long", message: `max ${MAX_VALUE_LEN} characters` }, 413);
  }
  const type = c.req.param("type").toLowerCase();
  if (!completableTypes().includes(type)) {
    return c.json(
      {
        error: "unsupported_type",
        message: `type '${type}' does not support check-digit completion`,
        supported: completableTypes(),
      },
      400,
    );
  }
  try {
    return c.json(completeCheckDigit(type, body));
  } catch (error) {
    return c.json(
      { error: "invalid_body", message: error instanceof Error ? error.message : "invalid body" },
      422,
    );
  }
});

app.post("/v1/validate", async (c) => {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return c.json({ error: "payload_too_large", max_bytes: MAX_BODY_BYTES }, 413);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const payload = body as { items?: unknown } | null;
  const items = (Array.isArray(payload) ? payload : payload?.items) as
    | Array<{ type?: unknown; value?: unknown }>
    | undefined;
  if (!Array.isArray(items)) {
    return c.json(
      {
        error: "invalid_request",
        message: 'send {"items":[{"type":"ean","value":"4006381333931"}]}',
      },
      400,
    );
  }
  if (items.length > 100) {
    return c.json(
      { error: "payload_too_large", message: `max 100 items per request; got ${items.length}` },
      413,
    );
  }
  const results = items.map((item, index) => {
    const type = String(item?.type ?? "").toLowerCase();
    const value = String(item?.value ?? "");
    if (value.length > MAX_VALUE_LEN) {
      return {
        index,
        type: type || null,
        input: null,
        valid: false,
        error: "value_too_long",
        message: `max ${MAX_VALUE_LEN} characters`,
      };
    }
    const entry = VALIDATORS[type];
    if (!entry) {
      return {
        index,
        type: type || null,
        input: item?.value ?? null,
        valid: false,
        error: "unsupported_type",
        supported: supportedTypes(),
      };
    }
    return { index, ...entry.validate(value) };
  });
  return c.json({ count: results.length, results });
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
