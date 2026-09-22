# RapidAPI listing copy (paste-ready)

## Name
CodeCheck API — Identifier & Checksum Validation

## Short description (one line)
Validate GTIN/EAN/UPC, ISBN, ISSN, ISIN, IBAN, LEI, VIN, IMEI, NPI, ABA, ORCID and ISO 6346 codes in milliseconds. Pure checksum math, no data lookups.

## Category
Data

## Tags
validation, gtin, ean, upc, barcode, iban, isbn, isin, lei, vin, imei, checksum, luhn, eori, vat, customs, compliance, swift, bic, sepa, mrz

## Long description (markdown)

**Fast, deterministic validation for the identifiers your data is full of.**

CodeCheck validates business and product identifiers by computing their
official checksums. No scraping, no third-party lookups, no caching, no
storage — the answer is derived from the value you send, so it is
consistent, fast and privacy-safe.

**Why developers pick it**

- **Milliseconds, not seconds.** Pure CPU arithmetic. No upstream call, so no timeouts and no downtime.
- **Honest results.** Every response separates `format`, `length` and `checkDigit`, plus `expectedCheckDigit` and `providedCheckDigit`. You see *why* something failed, not just that it did.
- **One call, many types.** 21 identifier types behind a single contract.
- **Batch up to 100 items per request.** Clean imported CSV/XLSX in one round trip.
- **Generate check digits too.** `GET /v1/complete/{type}/{body}` returns the correct check digit and the finished identifier — useful for test data and repairing broken imports.
- **Zero PII risk.** Values are never logged or stored; nothing is looked up in a database.

**Supported types**

| type | validates |
| --- | --- |
| gtin | GTIN-8 / 12 / 13 / 14 (EAN, UPC family) |
| ean | EAN-13 |
| upc | UPC-A |
| sscc | SSCC-18 shipping container code |
| isbn | ISBN-10 and ISBN-13 |
| issn | ISSN-8 |
| isin | ISIN-12 securities |
| iban | IBAN with per-country length table + mod-97 |
| lei | Legal Entity Identifier (ISO 17442) |
| vin | Vehicle identification number (ISO 3779) |
| imei | IMEI-15 |
| npi | US National Provider Identifier |
| aba | US ABA routing number |
| orcid | ORCID iD |
| iso6346 | Shipping container code |
| luhn | Any Luhn value |
| bic | BIC / SWIFT code (ISO 9362 + country) |
| rf | RF creditor reference (ISO 11649) |
| mrz | Passport / ID machine readable zone (ICAO 9303) |
| vat | EU/EFTA VAT number format (country prefix + national number) |
| eori | EORI customs number format |

**Typical uses**

- Data-cleaning pipelines: reject bad barcodes, VAT-side IBANs, ISBNs before they reach the database.
- E-commerce / ERP imports: validate GTINs and SSCCs from supplier files.
- EU B2B onboarding: check VAT numbers, IBANs, BICs, EORIs and LEIs in one contract.
- KYC / finance onboarding: check IBAN, LEI and BIC-side identifiers.
- Fleet, logistics and healthcare systems: VIN, container codes, IMEI, NPI.
- Test-data generation: read `expectedCheckDigit` to build valid samples.

**Example**

```
GET /v1/validate/gtin/4006381333931
```
```json
{
  "type": "gtin",
  "normalized": "4006381333931",
  "valid": true,
  "algorithm": "GS1 mod-10 (weights 3,1)",
  "checks": { "format": true, "length": true, "checkDigit": true },
  "expectedCheckDigit": "1",
  "providedCheckDigit": "1"
}
```

Batch:
```
POST /v1/validate
{"items":[{"type":"iban","value":"DE89 3704 0044 0532 0130 00"},{"type":"iso6346","value":"CSQU3054383"}]}
```

Spaces, dashes and lower case are normalised automatically.

## Pricing tiers (set in RapidAPI dashboard)

| plan | price | quota | rate limit |
| --- | --- | --- | --- |
| Basic | $0 | 500 calls / month | 10 req/s |
| Pro | $4.99 | 25,000 calls / month | 20 req/s |
| Ultra | $9.99 | 150,000 calls / month | 50 req/s |
| Mega | $29.99 | 1,000,000 calls / month | 100 req/s |

RapidAPI keeps ~20% of paid revenue.

## Endpoints for the dashboard

- `GET /v1/health` — public
- `GET /v1/types` — public
- `GET /v1/validate/{type}/{value}`
- `GET /v1/complete/{type}/{body}`
- `POST /v1/validate`

Import `openapi.yaml` to generate the endpoint docs automatically.

## Launch checklist (user steps)

1. `npx wrangler login`, then `npm run deploy`.
2. `npx wrangler secret put API_KEY` and `npx wrangler secret put RAPIDAPI_SECRET` (use the value from the RapidAPI dashboard → Security → Proxy Secret).
3. Confirm `DEV_MODE = "0"` in `wrangler.toml`.
4. Verify: `curl https://<worker>/v1/validate/ean/4006381333931 -H "x-api-key: <API_KEY>"`.
5. Create the API on rapidapi.com, import `openapi.yaml`, paste the copy above, add the tiers, attach the proxy secret, publish.
