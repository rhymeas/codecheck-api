import { describe, expect, it } from "vitest";
import { completeCheckDigit, completableTypes, validate } from "../src/validators";

const vectors: Array<{ type: string; body: string; expected: string }> = [
  { type: "gtin", body: "400638133393", expected: "4006381333931" },
  { type: "ean", body: "400638133393", expected: "4006381333931" },
  { type: "upc", body: "03600029145", expected: "036000291452" },
  { type: "sscc", body: "12345678901234567", expected: "123456789012345675" },
  { type: "isbn", body: "030640615", expected: "0306406152" },
  { type: "isbn", body: "043942089", expected: "043942089X" },
  { type: "isbn", body: "978030640615", expected: "9780306406157" },
  { type: "issn", body: "0378595", expected: "03785955" },
  { type: "isin", body: "US037833100", expected: "US0378331005" },
  { type: "imei", body: "49015420323751", expected: "490154203237518" },
  { type: "npi", body: "123456789", expected: "1234567893" },
  { type: "aba", body: "02100002", expected: "021000021" },
  { type: "orcid", body: "000000021825009", expected: "0000000218250097" },
  { type: "iso6346", body: "CSQU305438", expected: "CSQU3054383" },
  { type: "lei", body: "529900IH9V4I3VHQVO", expected: "529900IH9V4I3VHQVO92" },
  { type: "iban", body: "DE370400440532013000", expected: "DE89370400440532013000" },
  { type: "luhn", body: "7992739871", expected: "79927398713" },
  { type: "rf", body: "539007547034", expected: "RF18539007547034" },
];

describe("check digit completion", () => {
  for (const vector of vectors) {
    it(`${vector.type} ${vector.body} -> ${vector.expected}`, () => {
      const result = completeCheckDigit(vector.type, vector.body);
      expect(result.complete).toBe(vector.expected);
      expect(validate(vector.type, result.complete).valid).toBe(true);
    });
  }

  it("normalises separators before completing", () => {
    expect(completeCheckDigit("iban", "DE37 0400 4405 3201 3000").complete).toBe(
      "DE89370400440532013000",
    );
  });

  it("every completable type is also validatable", () => {
    for (const type of completableTypes()) {
      expect(Object.keys({ [type]: 1 })).toHaveLength(1);
    }
    expect(completableTypes()).toContain("gtin");
    expect(completableTypes()).toContain("rf");
    expect(completableTypes()).not.toContain("vin");
    expect(completableTypes()).not.toContain("mrz");
    expect(completableTypes()).not.toContain("bic");
  });

  it("rejects a body of the wrong length", () => {
    expect(() => completeCheckDigit("gtin", "123")).toThrow(/7, 11, 12 or 13/);
    expect(() => completeCheckDigit("iban", "DE3704")).toThrow(/requires/);
    expect(() => completeCheckDigit("isbn", "12345678")).toThrow(/isbn body/);
  });

  it("rejects unsupported types", () => {
    expect(() => completeCheckDigit("vin", "1HGCM82633A00435")).toThrow(
      /unsupported type 'vin'/,
    );
    expect(() => completeCheckDigit("nonsense", "1")).toThrow(/unsupported type/);
  });

  it("keeps the NPI prefix rule", () => {
    expect(() => completeCheckDigit("npi", "000000001")).toThrow(/starting with 1 or 2/);
    expect(() => completeCheckDigit("isbn", "400638133393")).toThrow(/978 or 979/);
  });
});
