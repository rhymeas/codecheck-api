import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { VALIDATORS, supportedTypes, completableTypes, validate } from "../src/validators.ts";

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

const today = new Date().toISOString().slice(0, 10);
const urls = ["", ...types.map((t) => `${t}.html`)].map((p) => `  <url><loc>${SITE}/${p}</loc><lastmod>${today}</lastmod></url>`).join("\n");
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  "utf8",
);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`, "utf8");

console.log(`generated ${types.length} type pages, sitemap.xml and robots.txt in docs/`);
