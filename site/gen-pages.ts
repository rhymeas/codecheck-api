import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  VALIDATORS,
  supportedTypes,
  completableTypes,
  validate,
  vatFormats,
  ibanCountries,
} from "../src/validators.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs");
const SITE = "https://rhymeas.github.io/codecheck-api";

const types = supportedTypes();
const completable = new Set(completableTypes());

const CSS = `:root{--bg:#0f1115;--panel:#171a21;--line:#262b36;--fg:#e7ebf0;--dim:#9aa4b2;--accent:#6ea8fe;--ok:#35c07a;--bad:#ef5f6b;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:880px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:28px;margin:0 0 8px;letter-spacing:-.02em}
h1 span{color:var(--accent)}
h2{font-size:18px;margin:32px 0 10px}
p.lead{color:var(--dim);margin:0 0 28px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 24px}
pre{background:#0b0d11;border:1px solid var(--line);border-radius:8px;padding:14px;overflow:auto;font:13px/1.5 var(--mono);white-space:pre-wrap;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
td:first-child{font-family:var(--mono)}
a{color:var(--accent)}
footer{color:var(--dim);font-size:13px;border-top:1px solid var(--line);padding-top:18px;margin-top:36px}
code{font-family:var(--mono)}
nav.types{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 0;padding:0;list-style:none}
nav.types a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:13px;text-decoration:none;color:var(--fg)}
nav.types a:hover{border-color:var(--accent);color:var(--accent)}`;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function relatedNav(current: string): string {
  const links = types
    .filter((t) => t !== current)
    .map((t) => `<a href="./${t}.html">${t}</a>`)
    .join("");
  return `<nav class="types"><a href="./index.html">demo</a>${links}</nav>`;
}

const GUIDES = [
  { slug: "iban-lengths", title: "IBAN country list" },
  { slug: "vat-number-formats", title: "VAT number formats" },
];

function guidesNav(): string {
  const links = GUIDES.map((g) => `<a href="./${g.slug}.html">${g.title}</a>`).join("");
  return `<nav class="types">${links}</nav>`;
}

function guideShell(slug: string, title: string, description: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${SITE}/${slug}.html" />
<style>
${CSS}
</style>
</head>
<body>
<main>
${body}
  <section class="card">
    <h2>Reference pages</h2>
    ${relatedNav("")}
    ${guidesNav()}
  </section>
  <footer>
    <p>Every check runs offline in the <a href="./index.html">browser demo</a>, or over the JSON API from the <a href="https://github.com/rhymeas/codecheck-api">open-source repository</a>.</p>
    <p>Nothing you type leaves the page — all checks are local arithmetic.</p>
  </footer>
</main>
</body>
</html>
`;
}

function ibanGuide(): string {
  const countries = ibanCountries();
  const rows = countries
    .map((c) => `<tr><td>${c.country}</td><td>${c.length}</td></tr>`)
    .join("\n        ");
  const body = `  <h1>IBAN <span>country list</span></h1>
  <p class="lead">Every country that uses IBAN, with the exact total length in characters. A valid IBAN must match the length of its country, then pass the ISO 13616 mod-97 check.</p>

  <section class="card">
    <h2>How the check works</h2>
    <p>Remove spaces and uppercase the string. Move the four leading characters (country code plus check digits) to the end. Replace each letter with its position in the alphabet plus 9 (A=10, B=11, ... Z=35). Read the result as one huge integer and take it modulo 97: a valid IBAN leaves remainder 1.</p>
    <p>That is pure arithmetic, so it needs no bank directory and no network call. Try it on the <a href="./iban.html">IBAN reference page</a> or in the <a href="./index.html?type=iban&amp;value=DE89370400440532013000">browser demo</a>.</p>
<pre>curl "https://&lt;your-worker&gt;.workers.dev/v1/validate/iban/DE89370400440532013000"</pre>
  </section>

  <section class="card">
    <h2>Lengths by country</h2>
    <p>${countries.length} countries are listed. Country codes not in this table are rejected, because no official IBAN length is defined for them.</p>
    <table>
      <thead>
        <tr><th>Country</th><th>IBAN length</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>

`;
  return guideShell(
    "iban-lengths",
    "IBAN country list — lengths and the mod-97 check",
    "Full IBAN country list with each IBAN length, plus how the ISO 13616 mod-97 check digit works and how to validate an IBAN offline.",
    body,
  );
}

function vatGuide(): string {
  const formats = vatFormats();
  const rows = formats
    .map((f) => `<tr><td>${f.country}</td><td>${escapeHtml(f.hint)}</td></tr>`)
    .join("\n        ");
  const body = `  <h1>VAT number <span>formats by country</span></h1>
  <p class="lead">The national format of every EU and EFTA VAT number, so you can reject malformed input before you ever call a lookup service.</p>

  <section class="card">
    <h2>Format check first, lookup second</h2>
    <p>Every VAT number starts with a two-letter country code followed by the national body. The body has a fixed shape per country, so a format check catches obvious typos and test data instantly, with no upstream call. Existence checks (VIES or a national registry) are a separate, slower step that only makes sense after the format is right.</p>
    <p>CodeCheck validates the format of all ${formats.length} countries below. Try one in the <a href="./index.html?type=vat&amp;value=DE123456789">browser demo</a> or read the <a href="./vat.html">VAT reference page</a>.</p>
<pre>curl "https://&lt;your-worker&gt;.workers.dev/v1/validate/vat/DE123456789"</pre>
  </section>

  <section class="card">
    <h2>Formats</h2>
    <table>
      <thead>
        <tr><th>Country</th><th>Body format</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>

`;
  return guideShell(
    "vat-number-formats",
    "EU and EFTA VAT number formats by country",
    "VAT number format for every EU and EFTA country, with the country prefix and national body pattern, so you can validate VAT numbers without a lookup call.",
    body,
  );
}

function page(type: string): string {
  const entry = VALIDATORS[type];
  const algorithm = validate(type, entry.examples[0]).algorithm;
  const isCompletable = completable.has(type);
  const title = `${type.toUpperCase()} validation — checksum algorithm, examples and API`;
  const description = `Validate a ${type.toUpperCase()} (${entry.description}) and see why a value fails: format, length and check digit. ${algorithm}.`;

  const exampleRows = entry.examples
    .map((value) => {
      const result = validate(type, value);
      return `<tr><td>${escapeHtml(value)}</td><td>${result.valid ? "valid" : "invalid"}</td><td>${
        result.expectedCheckDigit ?? "—"
      }</td><td>${result.providedCheckDigit ?? "—"}</td></tr>`;
    })
    .join("\n        ");

  const completeBlock = isCompletable
    ? `<p>This type has a single trailing check digit, so CodeCheck can also compute it:</p>
<pre>GET /v1/complete/${type}/{body}</pre>
<p><a href="./index.html?type=${type}&amp;value=${encodeURIComponent(entry.examples[0])}">Try it in the browser demo</a> — the demo runs the same code offline.</p>`
    : `<p>This type has no single trailing check digit, so there is no completion endpoint for it. Validation still reports format, length and any check digits found.</p>
<p><a href="./index.html?type=${type}&amp;value=${encodeURIComponent(entry.examples[0])}">Try it in the browser demo</a> — the demo runs the same code offline.</p>`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How do I validate a ${type.toUpperCase()}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Check the format and length, then recompute the check digit with ${algorithm} and compare it with the last character. CodeCheck does this locally in milliseconds via GET /v1/validate/${type}/{value}.`,
        },
      },
      {
        "@type": "Question",
        name: `What does an invalid ${type.toUpperCase()} mean?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `CodeCheck separates the result into format, length and checkDigit, and returns the expected and provided check digit, so an invalid ${type.toUpperCase()} tells you whether the shape is wrong, the length is wrong, or only the check digit is wrong.`,
        },
      },
    ],
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${SITE}/${type}.html" />
<style>
${CSS}
</style>
</head>
<body>
<main>
  <h1>${type.toUpperCase()} <span>validation</span></h1>
  <p class="lead">${escapeHtml(entry.description)} — checksum: ${escapeHtml(algorithm)}. Free in your browser, or over the JSON API.</p>

  <section class="card">
    <h2>What it is</h2>
    <p>${escapeHtml(entry.description)}. CodeCheck verifies three things separately — format, length and check digit — and returns the expected and provided check digit, so a failed value tells you exactly what is wrong instead of just saying no.</p>

    <h2>Algorithm</h2>
    <p>${escapeHtml(algorithm)}. The answer is derived from the value itself, with no database lookup and no third-party call, so it is deterministic, fast and privacy-safe.</p>

    <h2>Examples</h2>
    <table>
      <thead>
        <tr><th>Value</th><th>Result</th><th>Expected</th><th>Provided</th></tr>
      </thead>
      <tbody>
        ${exampleRows}
      </tbody>
    </table>

    <h2>API</h2>
<pre>curl "https://&lt;your-worker&gt;.workers.dev/v1/validate/${type}/${escapeHtml(entry.examples[0])}"</pre>
${completeBlock}
  </section>

  <section class="card">
    <h2>Other identifier types</h2>
    ${relatedNav(type)}
    ${guidesNav()}
  </section>

  <footer>
    <p>Same code offline: this reference and the <a href="./index.html">browser demo</a> both run the validators from the <a href="https://github.com/rhymeas/codecheck-api">open-source repository</a>.</p>
    <p>Nothing you type leaves the page — all checks are local arithmetic.</p>
  </footer>
</main>
<script type="application/ld+json">
${jsonLd}
</script>
</body>
</html>
`;
}

for (const type of types) {
  writeFileSync(join(out, `${type}.html`), page(type), "utf8");
}

writeFileSync(join(out, "iban-lengths.html"), ibanGuide(), "utf8");
writeFileSync(join(out, "vat-number-formats.html"), vatGuide(), "utf8");

const today = new Date().toISOString().slice(0, 10);
const pages = ["", ...types.map((t) => `${t}.html`), ...GUIDES.map((g) => `${g.slug}.html`)];
const urls = pages.map((p) => `  <url><loc>${SITE}/${p}</loc><lastmod>${today}</lastmod></url>`).join("\n");
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  "utf8",
);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`, "utf8");

console.log(`generated ${types.length} type pages, ${GUIDES.length} guide pages, sitemap.xml and robots.txt in docs/`);
