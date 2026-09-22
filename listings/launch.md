# Launch / content draft

## Live links (already public)
- Repository: <https://github.com/rhymeas/codecheck-api>
- In-browser demo (runs the validators client-side): <https://rhymeas.github.io/codecheck-api/>
- Per-type reference pages (algorithm, examples, API call, one per type): <https://rhymeas.github.io/codecheck-api/gtin.html>
- API base URL: fill in after `npm run deploy` (SETUP.md part A)

## Show HN / dev.to title options
- Show HN: I built a checksum-validation API that answers in 5 ms because it never calls anyone
- Your identifier validator is slow because it does a database lookup. It doesn't need to.
- 26 identifier checks, zero data lookups: why deterministic validation is the cheapest API you can run

## dev.to post draft

**TL;DR** — identifier validation (GTIN, IBAN, ISBN, VIN, LEI …) is pure
arithmetic. If you're paying per lookup or waiting on a third-party API, you
probably don't need to. I built CodeCheck to show the arithmetic version:
<5 ms, no upstream, no storage, batch of 100 per call.

### The problem with "validate this IBAN"

Most IBAN/GTIN/VAT checker APIs do a network lookup, so they inherit someone
else's latency and outage. But an IBAN check is one operation: rearrange the
string, expand letters to numbers, mod 97, compare to 1. There is no data to
fetch. Same for GTIN check digits, ISBN-10, ISSN, ISIN, IMEI, NPI, ABA routing
numbers, ORCID iDs and ISO 6346 container codes.

### What determines correctness

Each identifier has an official algorithm and a length table. Getting it right
means caring about the boring parts:

- GTIN uses mod-10 with weights 3,1 — **not** Luhn, even though ISIN/IMEI/NPI do use Luhn.
- LEI is ISO 17442 mod 97-10; the check is `98 - mod97(body + "00")`, zero-padded.
- VIN's check digit is a North-American rule. Plenty of valid EU VINs fail it, so a good API reports format validity and check-digit agreement separately instead of pretending the vehicle is fake.
- ABA routing numbers also have valid prefixes (00–12, 21–32, 61–72, 80) — a checksum alone lets `000000000` pass.

That last class of bug is why the response separates `format`, `length` and
`checkDigit`, and hands back `expectedCheckDigit` vs `providedCheckDigit`. When
an import fails at 2 a.m., "check digit mismatch, expected 7, got 8" is worth
more than `{"valid": false}`.

### Why no cache, no database, no queue

The service is a Cloudflare Worker with no bindings: ~85 KiB of JavaScript,
~21 KiB gzipped, zero runtime dependencies beyond a router. Because there is no
I/O, there's nothing to cache and nothing to rate-limit *for cost* — the only
real guard is input length, so each value is capped at 128 characters.

### Try it

```bash
curl "https://<worker>/v1/validate/iban/DE89%203704%200044%200532%200130%2000"
```
```json
{
  "type": "iban",
  "normalized": "DE89370400440532013000",
  "valid": true,
  "algorithm": "ISO 13616 mod-97-10",
  "checks": { "format": true, "length": true, "checkDigit": true },
  "country": "DE"
}
```

Batch endpoint takes up to 100 items, so a whole CSV column in one request:

```bash
curl -X POST "https://<worker>/v1/validate" -H "content-type: application/json" \
  -d '{"items":[{"type":"gtin","value":"4006381333931"},{"type":"gtin","value":"4006381333932"}]}'
```

### Generate valid test data

The same service runs backwards: `GET /v1/complete/{type}/{body}` returns the
correct check digit and the assembled identifier, so fixtures stop being
hand-edited copies of real data.

```bash
curl "https://<worker>/v1/complete/iban/DE370400440532013000"
# {"checkDigit":"89","complete":"DE89370400440532013000"}
```

### Pricing

Free tier covers 500 calls/month. Paid tiers start at $4.99. If you'd rather
self-host, the source is small on purpose — the only thing you can't cheaply
replicate is the pile of edge-case tests (75 at the time of writing, including
real LEIs pulled from GLEIF and canonical IBANs per country).

*If you find an identifier type that validates incorrectly, tell me — incorrect
validation is the one thing this API cannot afford.*

## Reddit / relevant-forum short version

Built a tiny API that validates GTIN/EAN/UPC, ISBN, ISSN, ISIN, IBAN, LEI, VIN,
IMEI, NPI, ABA, ORCID and ISO 6346 container codes. It's pure checksum math, so
it answers in single-digit ms with no upstream call — and it tells you *why*
something failed (`expectedCheckDigit` vs `providedCheckDigit`) instead of just
`valid: false`. Batch endpoint takes 100 values per call for CSV cleanup. Free
tier: 500 calls/month. Happy to hear which identifier type people hit next.

## Distribution checklist (user steps)

1. Publish the Worker, get the URL.
2. Publish the RapidAPI listing (`listings/rapidapi.md`).
3. Post the dev.to article with a link to the listing.
4. Post the short version to 1–2 relevant communities (r/webdev, r/ERP, r/dataisbeautiful is wrong — prefer data-engineering or e-commerce ops).
5. Add UptimeRobot (free) monitor on `/v1/health`.
6. Re-check revenue at month 3; if <$10/mo, swap the niche and reuse the harness.
