# Research notes and decision record

Date: 2026-09-22

## Goal
Beer-money passive income, target $50–200/month, budget €0, distribution up to
the builder. User instruction: "build this keep going. start generating income
autonomously."

## Method
Browsed live RapidAPI search results with the OpenChamber browser panel
(`https://rapidapi.com/search?term=<query>&sortBy=ByRelevance`) and recorded
result counts, listing ages, scores and latencies. Fetched vendor pricing pages
for Gumroad and Lemon Squeezy and the official YouTube monetisation policy.

## Evidence: rapid-API market is flooded (2026)

| query | results | observation |
| --- | --- | --- |
| "VAT validation" | 58 | Fresh competent entrants at 1–2 months old; established ones at score 9.6 / 1472 ms and 8.9 / 882 ms; several already market honest `valid:null` on VIES downtime and caching. Every obvious differentiation angle claimed. |
| "DMARC" | 65 | New entries from 2 days to 3 weeks old; latencies down to 123 ms. Saturated. |
| "e-invoicing" | ~10 | Small niche but already covered end-to-end (EN16931, Peppol, Factur-X, XRechnung, ZUGFeRD) by entries 2 days to 6 months old. |
| "GTIN barcode validation" | 1 | Exactly one generalist "Barcode & Business Code Toolkit". Thin competition — but thin competition here likely signals thin demand, not opportunity. |

Interpretation: generic, lookup-based dev APIs are commodity. Where demand is
proven the niche is flooded; where competition is thin the market is probably
small. Entering a flooded niche needs either data/licences (costs money) or
marketing (needs an audience). Neither fits €0 with no audience.

## Decision

Do **not** build a data-lookup API. Build a **deterministic, pure-arithmetic
identifier validation toolkit** instead. Rationale:

- No data source, so no licences, no scraping, no ToS exposure, no upstream outage.
- No personal data is fetched or stored, so GDPR exposure is minimal.
- Pure CPU → single-digit-millisecond responses, so no cache, no KV, no queue.
- Maintenance is effectively zero: the specifications do not change.
- The only nearby competitor is one generalist listing, and the differentiation
  is objective (latency, correctness, per-check breakdown, free tier).

Honest caveats, stated to the user and recorded here:

- The market for pure validation is thin. Revenue is likely small (single-digit
  to low-double-digit dollars per month at first) and is not guaranteed.
- "Autonomous income" is not achievable: publishing requires the user's
  RapidAPI account, and payouts require the user's identity and bank details.
  The builder can ship and verify the software; the accounts are user steps.
- Income is taxable; RapidAPI is not a merchant of record for VAT.

## What was built
Cloudflare Worker (TypeScript + Hono), zero runtime dependencies beyond the
router. 26 identifier types, single + batch validate endpoints, a check-digit
completion endpoint (`/v1/complete`, 21 of the 26 types) so the same service can
generate valid test data, and a public HTML landing page at `/`. 170 unit tests
covering real-world vectors (LEI values pulled from the GLEIF API, canonical
IBANs for DE/GB/FR, UPC/EAN/GTIN-8/14, ISBN-10 with X check, ISSN X check,
ORCID X check, ISO 6346 container, and a round-trip assertion that every
completed identifier validates). Both a code review and a security review were
run and their findings fixed:

- bounded input length (128 chars, single and batch) and body size cap
- generic error responses (no internal message leak)
- constant-time secret comparison
- ISBN-13 must begin 978/979; unknown IBAN country rejected; NPI must begin 1/2;
  ABA prefix ranges enforced; all-zero rejections; Luhn minimum length

## Kill rule
If revenue is below $10/month after three months, keep the harness and swap the
niche rather than debugging a market.
