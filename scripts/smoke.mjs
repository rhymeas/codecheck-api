const base = (process.argv[2] || process.env.BASE_URL || "").replace(/\/+$/, "");
const key = process.argv[3] || process.env.API_KEY || "";

if (!base) {
  console.error("usage: node scripts/smoke.mjs <baseUrl> [apiKey]");
  process.exit(2);
}

const headers = key ? { "x-api-key": key } : {};
let failures = 0;

async function check(name, path, verify, init = {}) {
  const started = Date.now();
  try {
    const res = await fetch(base + path, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const problem = verify(res, body);
    if (problem) {
      failures += 1;
      console.log(`FAIL  ${name}  ${res.status}  ${ms}ms  ${problem}`);
      console.log(`      ${text.slice(0, 300)}`);
    } else {
      console.log(`pass  ${name}  ${res.status}  ${ms}ms`);
    }
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}  request error: ${error.message}`);
  }
}

await check("health", "/v1/health", (res, body) =>
  res.status === 200 && body?.status === "ok" ? null : "expected status ok",
);

await check("types", "/v1/types", (res, body) =>
  res.status === 200 && body?.count >= 16 ? null : "expected at least 16 types",
);

await check("valid gtin", "/v1/validate/gtin/4006381333931", (res, body) =>
  res.status === 200 && body?.valid === true ? null : "expected valid true",
);

await check("invalid gtin", "/v1/validate/gtin/4006381333932", (res, body) =>
  res.status === 200 && body?.valid === false ? null : "expected valid false",
);

await check("complete gtin", "/v1/complete/gtin/400638133393", (res, body) =>
  res.status === 200 && body?.complete === "4006381333931"
    ? null
    : "expected complete 4006381333931",
);

await check(
  "batch",
  "/v1/validate",
  (res, body) =>
    res.status === 200 && body?.count === 2 && body?.results?.every((r) => r.valid)
      ? null
      : "expected 2 valid results",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [
        { type: "iban", value: "DE89 3704 0044 0532 0130 00" },
        { type: "iso6346", value: "CSQU3054383" },
      ],
    }),
  },
);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed against ${base}`);
  process.exit(1);
}

console.log(`\nall checks passed against ${base}`);
