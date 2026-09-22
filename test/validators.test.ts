import { describe, expect, it } from "vitest";
import { VALIDATORS, normalize, validate } from "../src/validators";

type Vector = { type: string; value: string; valid: boolean };

const validVectors: Vector[] = [
  { type: "gtin", value: "4006381333931", valid: true },
  { type: "gtin", value: "036000291452", valid: true },
  { type: "gtin", value: "9780306406157", valid: true },
  { type: "gtin", value: "4006381333932", valid: false },
  { type: "ean", value: "4006381333931", valid: true },
  { type: "ean", value: "4006381333930", valid: false },
  { type: "upc", value: "036000291452", valid: true },
  { type: "upc", value: "036000291453", valid: false },
  { type: "sscc", value: "123456789012345675", valid: true },
  { type: "sscc", value: "123456789012345674", valid: false },
  { type: "isbn", value: "0306406152", valid: true },
  { type: "isbn", value: "9780306406157", valid: true },
  { type: "isbn", value: "0306406153", valid: false },
  { type: "issn", value: "03785955", valid: true },
  { type: "issn", value: "03785956", valid: false },
  { type: "isin", value: "US0378331005", valid: true },
  { type: "isin", value: "US0378331004", valid: false },
  { type: "iban", value: "DE89370400440532013000", valid: true },
  { type: "iban", value: "DE89370400440532013001", valid: false },
  { type: "lei", value: "529900IH9V4I3VHQVO92", valid: true },
  { type: "lei", value: "391200PCHLV827FDCB76", valid: true },
  { type: "lei", value: "529900IH9V4I3VHQVO93", valid: false },
  { type: "vin", value: "1HGCM82633A004352", valid: true },
  { type: "imei", value: "490154203237518", valid: true },
  { type: "imei", value: "490154203237519", valid: false },
  { type: "npi", value: "1234567893", valid: true },
  { type: "npi", value: "1234567894", valid: false },
  { type: "aba", value: "021000021", valid: true },
  { type: "aba", value: "021000022", valid: false },
  { type: "orcid", value: "0000-0002-1825-0097", valid: true },
  { type: "orcid", value: "0000-0002-1825-0098", valid: false },
  { type: "iso6346", value: "CSQU3054383", valid: true },
  { type: "iso6346", value: "CSQU3054384", valid: false },
  { type: "luhn", value: "79927398713", valid: true },
  { type: "luhn", value: "79927398710", valid: false },
  { type: "bic", value: "DEUTDEFF", valid: true },
  { type: "bic", value: "DEUTDEFF500", valid: true },
  { type: "bic", value: "DEUTDEFF50", valid: false },
  { type: "bic", value: "DEUTZZFF", valid: false },
  { type: "rf", value: "RF18539007547034", valid: true },
  { type: "rf", value: "RF19539007547034", valid: false },
  { type: "mrz", value: "L898902C36UTO7408122F1204159ZE184226B<<<<<10", valid: true },
  { type: "mrz", value: "L898902C36UTO7408122F1204159ZE184226B<<<<<11", valid: false },
  { type: "vat", value: "DE123456789", valid: true },
  { type: "vat", value: "ATU12345678", valid: true },
  { type: "vat", value: "FR12345678901", valid: true },
  { type: "vat", value: "GB123456789", valid: true },
  { type: "vat", value: "NL123456789B01", valid: true },
  { type: "vat", value: "CHE116281710MWST", valid: true },
  { type: "vat", value: "NO123456789MVA", valid: true },
  { type: "vat", value: "EL123456789", valid: true },
  { type: "vat", value: "GR123456789", valid: true },
  { type: "vat", value: "CY12345678A", valid: true },
  { type: "vat", value: "de 123 456 789", valid: true },
  { type: "vat", value: "DE12345678", valid: false },
  { type: "vat", value: "DE1234567890", valid: false },
  { type: "vat", value: "AT12345678", valid: false },
  { type: "vat", value: "GB12345678", valid: false },
  { type: "vat", value: "NL123456789C01", valid: false },
  { type: "vat", value: "CHE1162817100000", valid: false },
  { type: "vat", value: "XX123456789", valid: false },
  { type: "vat", value: "US123456789", valid: false },
  { type: "vat", value: "123456789", valid: false },
  { type: "eori", value: "DE123456789012345", valid: true },
  { type: "eori", value: "FR1234567890", valid: true },
  { type: "eori", value: "NL123456789B01", valid: true },
  { type: "eori", value: "D123456789", valid: false },
  { type: "eori", value: "XZ123456789", valid: false },
  { type: "eori", value: "DE1234567890123456", valid: false },
  { type: "eori", value: "DE", valid: false },
];

describe("validation vectors", () => {
  for (const vector of validVectors) {
    it(`${vector.type} ${vector.value} -> ${vector.valid}`, () => {
      expect(validate(vector.type, vector.value).valid).toBe(vector.valid);
    });
  }
});

describe("normalization", () => {
  it("strips separators and uppercases", () => {
    expect(normalize("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
  });
  it("accepts formatted gtin", () => {
    expect(validate("gtin", "4006 3813 3393 1").valid).toBe(true);
  });
  it("accepts formatted orcid", () => {
    expect(validate("orcid", "0000-0002-1825-0097").valid).toBe(true);
  });
});

describe("vin check digit reporting", () => {
  it("reports matching check digit but stays format-valid", () => {
    const result = validate("vin", "1HGCM82633A004352");
    expect(result.valid).toBe(true);
    expect(result.checks.checkDigit).toBe(true);
    expect(result.expectedCheckDigit).toBe("3");
  });
  it("reports mismatch without failing the format", () => {
    const result = validate("vin", "1HGCM82634A004352");
    expect(result.valid).toBe(true);
    expect(result.checks.checkDigit).toBe(false);
  });
});

describe("length rules", () => {
  it("rejects wrong gtin length", () => {
    const result = validate("gtin", "123456");
    expect(result.valid).toBe(false);
    expect(result.checks.length).toBe(false);
  });
  it("rejects unknown iban country codes", () => {
    const result = validate("iban", "ZZ89370400440532013000");
    expect(result.valid).toBe(false);
    expect(result.checks.format).toBe(false);
    expect(result.reason).toContain("unknown iban country code");
  });
});

describe("hardening vectors", () => {
  const extra: Vector[] = [
    { type: "gtin", value: "96385074", valid: true },
    { type: "gtin", value: "00012345600012", valid: true },
    { type: "gtin", value: "00000000", valid: false },
    { type: "isbn", value: "043942089X", valid: true },
    { type: "isbn", value: "4006381333931", valid: false },
    { type: "isbn", value: "0000000000000", valid: false },
    { type: "issn", value: "0000006X", valid: true },
    { type: "issn", value: "00000000", valid: false },
    { type: "orcid", value: "0000-0002-1694-233X", valid: true },
    { type: "iban", value: "GB82WEST12345698765432", valid: true },
    { type: "iban", value: "FR1420041010050500013M02606", valid: true },
    { type: "iban", value: "ZZ22370400440532013000", valid: false },
    { type: "aba", value: "011000015", valid: true },
    { type: "aba", value: "000000000", valid: false },
    { type: "npi", value: "0000000006", valid: false },
    { type: "vin", value: "1HGCM8263IA004352", valid: false },
    { type: "imei", value: "000000000000000", valid: false },
    { type: "luhn", value: "0", valid: false },
  ];
  for (const vector of extra) {
    it(`${vector.type} ${vector.value} -> ${vector.valid}`, () => {
      expect(validate(vector.type, vector.value).valid).toBe(vector.valid);
    });
  }
  it("rejects unicode digits", () => {
    expect(validate("gtin", "\uFF14\uFF10\uFF10\uFF16\uFF13\uFF18\uFF11\uFF13\uFF13\uFF19\uFF13\uFF11").valid).toBe(false);
  });
  it("rejects empty input", () => {
    expect(validate("luhn", "").valid).toBe(false);
  });
});

describe("mrz reporting", () => {
  it("reports issuing country and composite check digit", () => {
    const result = validate("mrz", "L898902C36UTO7408122F1204159ZE184226B<<<<<10");
    expect(result.valid).toBe(true);
    expect(result.country).toBe("UTO");
    expect(result.providedCheckDigit).toBe("0");
    expect(result.checks.checkDigit).toBe(true);
  });
  it("names the failing field", () => {
    const result = validate("mrz", "L898902C46UTO7408122F1204159ZE184226B<<<<<10");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("documentNumber");
  });
  it("rejects a short mrz line", () => {
    const result = validate("mrz", "L898902C36");
    expect(result.valid).toBe(false);
    expect(result.checks.length).toBe(false);
  });
});

describe("registry", () => {
  it("exposes every validator with metadata", () => {
    for (const [key, entry] of Object.entries(VALIDATORS)) {
      expect(entry.type).toBe(key);
      expect(entry.examples.length).toBeGreaterThan(0);
      for (const example of entry.examples) {
        expect(entry.validate(example).valid).toBe(true);
      }
    }
  });
  it("throws on unsupported type", () => {
    expect(() => validate("nope", "1")).toThrow("unsupported type 'nope'");
  });
});
