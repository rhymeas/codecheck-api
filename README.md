# CodeCheck API

Deterministic identifier and checksum validation as a Cloudflare Worker.

**Live demo (runs these same validators in your browser):**
https://rhymeas.github.io/codecheck-api/

Pure math, zero data lookups, zero storage, no external dependencies at
runtime. Every response is computed from the input alone, so the service is
cacheable, privacy-safe and cheap to run.

```
GET  /v1/validate/{type}/{value}
POST /v1/validate           (up to 100 items per call)
GET  /v1/complete/{type}/{body}   (compute the check digit)
GET  /v1/types
GET  /v1/health
GET  /                            (JSON info, or an HTML page in a browser)
```

## Supported types

| type | what it validates | algorithm |
| --- | --- | --- |
| gtin | GTIN-8/12/13/14 (EAN/UPC family) | GS1 mod-10 (3,1) |
| ean | EAN-13 | GS1 mod-10 (3,1) |
| upc | UPC-A | GS1 mod-10 (3,1) |
| sscc | SSCC-18 shipping container code | GS1 mod-10 (3,1) |
| isbn | ISBN-10 and ISBN-13 | mod-11 / mod-10 |
| issn | ISSN-8 | mod-11 (weights 8..2) |
| isin | ISIN-12 securities | Luhn, letters A=10..Z=35 |
| iban | IBAN account numbers | ISO 13616 mod-97 + country lengths |
| lei | Legal Entity Identifier | ISO 17442 mod-97-10 |
| vin | Vehicle identification number | ISO 3779 check digit |
| imei | IMEI-15 | Luhn |
| npi | US National Provider Identifier | Luhn with 80840 prefix |
| aba | US ABA routing number | mod-10 (3,7,1) |
| orcid | ORCID iD | ISO 7064 MOD 11-2 |
| iso6346 | Shipping container code | mod-11 |
| luhn | Any Luhn value | Luhn |
| bic | BIC / SWIFT code | ISO 9362 + ISO 3166 country |
| rf | RF creditor reference | ISO 11649 mod-97 |
| mrz | Machine readable zone line | ICAO 9303 TD3 check digits |
| vat | EU/EFTA VAT number | per-country format (prefix + national number) |
| eori | EORI customs number | country code + 1..15 alphanumeric |
| cusip | CUSIP-9 North American securities | mod-10 with digit summing |
| sedol | SEDOL-7 UK/Ireland securities | mod-10 (1,3,1,7,3,9,1) |
| figi | FIGI-12 financial instrument ID | mod-10 with digit summing |
| cas | CAS Registry number | mod-10 positional weights |
| isni | ISNI-16 name identifier | ISO 7064 MOD 11-2 |

## Example

```bash
curl "https://<your-worker>.workers.dev/v1/validate/gtin/4006381333931" \
  -H "x-api-key: $API_KEY"
```

```json
{
  "type": "gtin",
  "input": "4006381333931",
  "normalized": "4006381333931",
  "valid": true,
  "algorithm": "GS1 mod-10 (weights 3,1)",
  "checks": { "format": true, "length": true, "checkDigit": true },
  "expectedCheckDigit": "1",
  "providedCheckDigit": "1",
  "country": null,
  "reason": null
}
```

Batch:

```bash
curl -X POST "https://<your-worker>.workers.dev/v1/validate" \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"items":[{"type":"iban","value":"DE89 3704 0044 0532 0130 00"},{"type":"iso6346","value":"CSQU3054383"}]}'
```

Separators (spaces, dashes, lower case) are normalised automatically.

## Compute a check digit

For test data and import repair, `/v1/complete` takes the body of an identifier
and returns the correct check digit plus the finished value.

```bash
curl "https://<your-worker>.workers.dev/v1/complete/gtin/400638133393" \
  -H "x-api-key: $API_KEY"
```

```json
{
  "type": "gtin",
  "body": "400638133393",
  "normalized": "400638133393",
  "checkDigit": "1",
  "complete": "4006381333931",
  "algorithm": "GS1 mod-10 (weights 3,1)"
}
```

Supported for every type with a trailing check digit: `gtin`, `ean`, `upc`,
`sscc`, `isbn`, `issn`, `isin`, `imei`, `npi`, `aba`, `orcid`, `iso6346`, `lei`,
`iban`, `luhn` and `rf`. For an IBAN, send the country code followed by the
BBAN (`DE370400440532013000`) and the check digits are inserted after the
country code; for an RF reference, send the reference body (`539007547034`) and
the check digits are inserted after `RF`. `vin` is not supported: its check
digit sits in the middle, not at the end. `mrz` and `bic` are not supported:
they carry several independent check digits or none; `vat` and `eori` are not
supported because their formats define no check digit.

## Response semantics

- `valid` is the overall verdict. For every type except `vin` a check-digit
  mismatch means `valid: false`.
- `vin` is the exception: the ISO 3779 check digit is a North-American rule and
  most valid European VINs do not satisfy it. `valid` therefore reports format
  validity and `checks.checkDigit` reports whether the check digit agrees
  (see `reason` in that case).
- `checks.format`, `checks.length` and `checks.checkDigit` isolate the cause of
  a failure; `expectedCheckDigit` and `providedCheckDigit` show the arithmetic
  behind it.

## Local development

```bash
npm install
copy .dev.vars.example .dev.vars   # DEV_MODE=1 disables auth locally
npm run dev
npm test
npm run typecheck
```

## Deploy

```bash
npx wrangler login
npx wrangler secret put API_KEY
npx wrangler secret put RAPIDAPI_SECRET
npm run deploy
npm run smoke -- https://<your-worker>.workers.dev <your-api-key>
```

Set `DEV_MODE = "0"` in `wrangler.toml` before deploying anything public.
`RAPIDAPI_SECRET` is the value RapidAPI sends as `x-rapidapi-proxy-secret`;
it lets marketplace traffic through while keeping direct calls key-gated.

`SETUP.md` is the complete runbook: accounts, deploy, marketplace listing and
launch, including the steps that need your own identity.

## Runtime properties

- Bundle: ~114 KiB raw, ~27 KiB gzip, no runtime dependencies beyond Hono.
- Latency: single-digit milliseconds, pure CPU, no I/O.
- State: none. No database, no KV, no logging of inputs.
- Data protection: no personal data is stored or looked up; input is only
  checked arithmetically.

## Hardening

- Single values are capped at 128 characters and request bodies at 1 MB
  (`413` beyond that) so CPU cost stays bounded.
- Secrets are compared in constant time; missing or empty either side fails.
- Error responses never echo internal messages or configuration.
- `DEV_MODE=1` disables auth entirely. It is `"0"` in `wrangler.toml`; check it
  before every deploy.
- Consider a Cloudflare Rate Limiting rule in front of the Worker once the
  RapidAPI listing is live.

## Licence

MIT
