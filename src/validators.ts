export type Checks = {
  format: boolean;
  length: boolean;
  checkDigit: boolean | null;
};

export type ValidationResult = {
  type: string;
  input: string;
  normalized: string;
  valid: boolean;
  algorithm: string;
  checks: Checks;
  expectedCheckDigit: string | null;
  providedCheckDigit: string | null;
  country: string | null;
  reason: string | null;
};

type Extra = Partial<
  Omit<ValidationResult, "type" | "input" | "normalized" | "valid" | "algorithm">
>;

const DIGITS = /^[0-9]+$/;
const ALL_ZERO = /^0+$/;
const CONTAINER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

const VIN_TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4,
  N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const ABA_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1];

const CONTAINER_VALUES: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  let value = 10;
  for (const letter of CONTAINER_LETTERS) {
    while (value % 11 === 0) value += 1;
    map[letter] = value;
    value += 1;
  }
  return map;
})();

export function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function make(
  type: string,
  input: string,
  normalized: string,
  algorithm: string,
  valid: boolean,
  extra: Extra = {},
): ValidationResult {
  return {
    type,
    input,
    normalized,
    valid,
    algorithm,
    checks: { format: true, length: true, checkDigit: valid },
    expectedCheckDigit: null,
    providedCheckDigit: null,
    country: null,
    reason: null,
    ...extra,
  };
}

function expandAlpha(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) out += ch;
    else if (code >= 65 && code <= 90) out += String(code - 55);
  }
  return out;
}

function mod10CheckDigit(body: string): number {
  const digits = body.split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i].charCodeAt(0) - 48;
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

function luhnSum(value: string): number {
  const digits = value.split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i].charCodeAt(0) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum;
}

function luhnCheckDigit(body: string): number {
  const digits = body.split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i].charCodeAt(0) - 48;
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

function mod97(numeric: string): number {
  let r = 0;
  for (const ch of numeric) r = (r * 10 + (ch.charCodeAt(0) - 48)) % 97;
  return r;
}

function mod11_2(digits: string): number {
  let total = 0;
  for (const ch of digits) total = ((total + (ch.charCodeAt(0) - 48)) * 2) % 11;
  return (12 - (total % 11)) % 11;
}

function gtinLike(type: string, raw: string, lengths: number[]): ValidationResult {
  const algorithm = "GS1 mod-10 (weights 3,1)";
  const n = normalize(raw);
  if (!DIGITS.test(n)) {
    return make(type, raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "must contain digits only",
    });
  }
  if (!lengths.includes(n.length)) {
    return make(type, raw, n, algorithm, false, {
      checks: { format: true, length: false, checkDigit: null },
      reason: `length must be ${lengths.join("/")}; got ${n.length}`,
    });
  }
  if (ALL_ZERO.test(n)) {
    return make(type, raw, n, algorithm, false, {
      checks: { format: true, length: true, checkDigit: null },
      reason: "all-zero value is not a valid code",
    });
  }
  const provided = n.slice(-1);
  const expected = String(mod10CheckDigit(n.slice(0, -1)));
  const checkDigit = provided === expected;
  return make(type, raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateGtin(raw: string): ValidationResult {
  return gtinLike("gtin", raw, [8, 12, 13, 14]);
}

export function validateEan(raw: string): ValidationResult {
  return gtinLike("ean", raw, [13]);
}

export function validateUpc(raw: string): ValidationResult {
  return gtinLike("upc", raw, [12]);
}

export function validateSscc(raw: string): ValidationResult {
  return gtinLike("sscc", raw, [18]);
}

export function validateIsbn(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISBN-10 mod-11 / ISBN-13 mod-10";
  const tenOk = /^[0-9]{9}[0-9X]$/.test(n);
  const thirteenOk = /^[0-9]{13}$/.test(n);
  if (!tenOk && !thirteenOk) {
    const lengthOk = n.length === 10 || n.length === 13;
    return make("isbn", raw, n, algorithm, false, {
      checks: { format: false, length: lengthOk, checkDigit: null },
      reason: lengthOk
        ? "isbn must contain digits only, with an optional trailing X for ISBN-10"
        : "length must be 10 or 13",
    });
  }
  if (ALL_ZERO.test(n)) {
    return make("isbn", raw, n, algorithm, false, {
      checks: { format: true, length: true, checkDigit: null },
      reason: "all-zero value is not a valid code",
    });
  }
  if (thirteenOk) {
    if (!/^97[89]/.test(n)) {
      return make("isbn", raw, n, "ISBN-13 mod-10", false, {
        checks: { format: false, length: true, checkDigit: null },
        reason: "ISBN-13 must start with 978 or 979",
      });
    }
    const provided = n.slice(-1);
    const expected = String(mod10CheckDigit(n.slice(0, -1)));
    const checkDigit = provided === expected;
    return make("isbn", raw, n, "ISBN-13 mod-10", checkDigit, {
      checks: { format: true, length: true, checkDigit },
      expectedCheckDigit: expected,
      providedCheckDigit: provided,
      reason: checkDigit ? null : "check digit mismatch",
    });
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (n.charCodeAt(i) - 48) * (10 - i);
  const r = (11 - (sum % 11)) % 11;
  const expected = r === 10 ? "X" : String(r);
  const provided = n[9];
  const checkDigit = provided === expected;
  return make("isbn", raw, n, "ISBN-10 mod-11", checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateIssn(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISSN mod-11 (weights 8..2)";
  if (!/^[0-9]{7}[0-9X]$/.test(n)) {
    const lengthOk = n.length === 8;
    return make("issn", raw, n, algorithm, false, {
      checks: { format: false, length: lengthOk, checkDigit: null },
      reason: lengthOk
        ? "issn must contain digits only, with an optional trailing X"
        : "length must be 8 (7 digits plus digit or X)",
    });
  }
  if (ALL_ZERO.test(n)) {
    return make("issn", raw, n, algorithm, false, {
      checks: { format: true, length: true, checkDigit: null },
      reason: "all-zero value is not a valid code",
    });
  }
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (n.charCodeAt(i) - 48) * (8 - i);
  const r = (11 - (sum % 11)) % 11;
  const expected = r === 10 ? "X" : String(r);
  const provided = n[7];
  const checkDigit = provided === expected;
  return make("issn", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateIsin(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "Luhn mod-10 with letters expanded (A=10..Z=35)";
  if (!/^[A-Z]{2}[0-9A-Z]{9}[0-9]$/.test(n)) {
    return make("isin", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "isin must be 2 letters, 9 alphanumeric and a final digit",
    });
  }
  const valid = luhnSum(expandAlpha(n)) % 10 === 0;
  return make("isin", raw, n, algorithm, valid, {
    checks: { format: true, length: true, checkDigit: valid },
    providedCheckDigit: n.slice(-1),
    country: n.slice(0, 2),
    reason: valid ? null : "checksum mismatch",
  });
}

export function validateIban(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 13616 mod-97-10";
  const country = /^[A-Z]{2}/.test(n) ? n.slice(0, 2) : null;
  if (!/^[A-Z]{2}[0-9]{2}[0-9A-Z]+$/.test(n)) {
    return make("iban", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      country,
      reason: "iban must start with 2 letters, 2 check digits and alphanumerics",
    });
  }
  const expectedLength = country ? IBAN_LENGTHS[country] : undefined;
  if (expectedLength === undefined) {
    return make("iban", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      country,
      reason: `unknown iban country code ${country}`,
    });
  }
  const lengthOk = n.length === expectedLength;
  const valid = mod97(expandAlpha(n.slice(4) + n.slice(0, 4))) === 1;
  return make("iban", raw, n, algorithm, lengthOk && valid, {
    checks: { format: true, length: lengthOk, checkDigit: valid },
    providedCheckDigit: n.slice(2, 4),
    country,
    reason: lengthOk
      ? valid
        ? null
        : "mod-97 check failed"
      : `country ${country} requires ${expectedLength} characters; got ${n.length}`,
  });
}

export function validateLei(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 17442 mod-97-10";
  if (!/^[0-9A-Z]{20}$/.test(n)) {
    return make("lei", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "lei must be 20 alphanumeric characters",
    });
  }
  const provided = n.slice(18);
  const expected = String(98 - mod97(expandAlpha(n.slice(0, 18)) + "00")).padStart(2, "0");
  const checkDigit = provided === expected;
  return make("lei", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateVin(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 3779 check digit (North America)";
  if (!/^[0-9A-HJ-NPR-Z]{17}$/.test(n)) {
    return make("vin", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "vin must be 17 characters without I, O or Q",
    });
  }
  if (ALL_ZERO.test(n)) {
    return make("vin", raw, n, algorithm, false, {
      checks: { format: true, length: true, checkDigit: null },
      reason: "all-zero value is not a valid code",
    });
  }
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = n[i];
    const code = ch >= "0" && ch <= "9" ? ch.charCodeAt(0) - 48 : VIN_TRANSLIT[ch];
    sum += code * VIN_WEIGHTS[i];
  }
  const r = sum % 11;
  const expected = r === 10 ? "X" : String(r);
  const provided = n[8];
  const checkDigit = provided === expected;
  return make("vin", raw, n, algorithm, true, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit does not match; valid for non North-American vins",
  });
}

export function validateImei(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "Luhn mod-10";
  if (!/^[0-9]{15}$/.test(n)) {
    return make("imei", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "imei must be 15 digits",
    });
  }
  if (ALL_ZERO.test(n)) {
    return make("imei", raw, n, algorithm, false, {
      checks: { format: true, length: true, checkDigit: null },
      reason: "all-zero value is not a valid code",
    });
  }
  const valid = luhnSum(n) % 10 === 0;
  const expected = String(luhnCheckDigit(n.slice(0, 14)));
  return make("imei", raw, n, algorithm, valid, {
    checks: { format: true, length: true, checkDigit: valid },
    expectedCheckDigit: expected,
    providedCheckDigit: n.slice(-1),
    reason: valid ? null : "luhn checksum failed",
  });
}

export function validateNpi(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "Luhn mod-10 with CMS prefix 80840";
  if (!/^[12][0-9]{9}$/.test(n)) {
    const lengthOk = n.length === 10;
    return make("npi", raw, n, algorithm, false, {
      checks: { format: false, length: lengthOk, checkDigit: null },
      reason: lengthOk ? "npi must start with 1 or 2" : "npi must be 10 digits",
    });
  }
  const expected = String(luhnCheckDigit(`80840${n.slice(0, 9)}`));
  const provided = n.slice(-1);
  const checkDigit = provided === expected;
  return make("npi", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    country: "US",
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateAba(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ABA mod-10 (weights 3,7,1)";
  if (!/^[0-9]{9}$/.test(n)) {
    return make("aba", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "routing number must be 9 digits",
    });
  }
  const prefix = Number(n.slice(0, 2));
  const prefixOk =
    prefix <= 12 || (prefix >= 21 && prefix <= 32) || (prefix >= 61 && prefix <= 72) || prefix === 80;
  if (!prefixOk || ALL_ZERO.test(n)) {
    return make("aba", raw, n, algorithm, false, {
      checks: { format: false, length: true, checkDigit: null },
      country: "US",
      reason: "invalid ABA routing prefix or all-zero number",
    });
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (n.charCodeAt(i) - 48) * ABA_WEIGHTS[i];
  const valid = sum % 10 === 0;
  return make("aba", raw, n, algorithm, valid, {
    checks: { format: true, length: true, checkDigit: valid },
    providedCheckDigit: n.slice(-1),
    country: "US",
    reason: valid ? null : "checksum mismatch",
  });
}

export function validateOrcid(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 7064 MOD 11-2";
  if (!/^[0-9]{15}[0-9X]$/.test(n)) {
    return make("orcid", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "orcid must be 16 characters (15 digits plus digit or X)",
    });
  }
  const r = mod11_2(n.slice(0, 15));
  const expected = r === 10 ? "X" : String(r);
  const provided = n[15];
  const checkDigit = provided === expected;
  return make("orcid", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateIso6346(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 6346 mod-11 check digit";
  if (!/^[A-Z]{4}[0-9]{7}$/.test(n)) {
    return make("iso6346", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "container code must be 4 letters followed by 7 digits",
    });
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = n[i];
    const value = i < 4 ? CONTAINER_VALUES[ch] : ch.charCodeAt(0) - 48;
    sum += value * Math.pow(2, i);
  }
  let r = sum % 11;
  if (r === 10) r = 0;
  const expected = String(r);
  const provided = n[10];
  const checkDigit = provided === expected;
  return make("iso6346", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateLuhn(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "Luhn mod-10";
  if (!DIGITS.test(n)) {
    return make("luhn", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "value must contain digits only",
    });
  }
  if (n.length < 2 || ALL_ZERO.test(n)) {
    return make("luhn", raw, n, algorithm, false, {
      checks: { format: true, length: false, checkDigit: null },
      reason: "value must have at least 2 non-zero digits",
    });
  }
  const valid = luhnSum(n) % 10 === 0;
  return make("luhn", raw, n, algorithm, valid, {
    checks: { format: true, length: true, checkDigit: valid },
    providedCheckDigit: n.slice(-1),
    reason: valid ? null : "luhn checksum failed",
  });
}

const ISO_COUNTRIES = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK".split(
    " ",
  ),
);

const normalizeMrz = (raw: string): string => raw.trim().toUpperCase().replace(/\s+/g, "");

function icaoCheckDigit(value: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = ch.charCodeAt(0);
    const v = ch === "<" ? 0 : code >= 48 && code <= 57 ? code - 48 : code - 55;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

const MRZ_TD3_FIELDS = [
  { name: "documentNumber", start: 0, end: 9, check: 9 },
  { name: "dateOfBirth", start: 13, end: 19, check: 19 },
  { name: "dateOfExpiry", start: 21, end: 27, check: 27 },
  { name: "personalNumber", start: 28, end: 42, check: 42 },
];

export function validateBic(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 9362 format";
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(n)) {
    const lengthOk = n.length === 8 || n.length === 11;
    return make("bic", raw, n, algorithm, false, {
      checks: { format: false, length: lengthOk, checkDigit: null },
      reason: lengthOk
        ? "bic must be 4 letters, 2 letters and 2 alphanumeric characters"
        : "bic must be 8 or 11 characters",
    });
  }
  const country = n.slice(4, 6);
  const countryOk = ISO_COUNTRIES.has(country);
  return make("bic", raw, n, algorithm, countryOk, {
    checks: { format: true, length: true, checkDigit: null },
    country,
    reason: countryOk ? null : `unknown bic country code ${country}`,
  });
}

export function validateRf(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 11649 mod-97-10";
  if (!/^RF[0-9]{2}[0-9A-Z]{1,21}$/.test(n)) {
    const prefixOk = /^RF/.test(n);
    return make("rf", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: prefixOk
        ? "creditor reference must be RF, 2 check digits and up to 21 characters"
        : "creditor reference must start with RF",
    });
  }
  const provided = n.slice(2, 4);
  const expected = String(98 - mod97(expandAlpha(n.slice(4) + "RF00"))).padStart(2, "0");
  const checkDigit = provided === expected;
  const valid = checkDigit && mod97(expandAlpha(n.slice(4) + n.slice(0, 4))) === 1;
  return make("rf", raw, n, algorithm, valid, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: valid ? null : "check digit mismatch",
  });
}

export function validateMrz(raw: string): ValidationResult {
  const n = normalizeMrz(raw);
  const algorithm = "ICAO 9303 TD3 check digits (weights 7,3,1)";
  if (!/^[A-Z0-9<]{44}$/.test(n)) {
    const lengthOk = n.length === 44;
    return make("mrz", raw, n, algorithm, false, {
      checks: { format: false, length: lengthOk, checkDigit: null },
      reason: lengthOk
        ? "mrz line must contain only A-Z, 0-9 or <"
        : "TD3 second line must be 44 characters",
    });
  }
  const fields = MRZ_TD3_FIELDS.map((field) => {
    const expected = String(icaoCheckDigit(n.slice(field.start, field.end)));
    const provided = n[field.check];
    return { name: field.name, provided, expected, ok: provided === expected };
  });
  const compositeExpected = String(
    icaoCheckDigit(n.slice(0, 10) + n.slice(13, 20) + n.slice(21, 28) + n.slice(28, 43)),
  );
  const compositeProvided = n[43];
  const compositeOk = compositeProvided === compositeExpected;
  const mismatches = fields.filter((f) => !f.ok).map((f) => f.name);
  const valid = mismatches.length === 0 && compositeOk;
  const labels = compositeOk ? mismatches : [...mismatches, "composite"];
  return make("mrz", raw, n, algorithm, valid, {
    checks: { format: true, length: true, checkDigit: valid },
    expectedCheckDigit: compositeExpected,
    providedCheckDigit: compositeProvided,
    country: n.slice(10, 13),
    reason: valid ? null : `check digit mismatch in ${labels.join(", ")}`,
  });
}

const VAT_BODY: Record<string, { body: RegExp; hint: string }> = {
  AT: { body: /^U[0-9]{8}$/, hint: "AT, U and 8 digits" },
  BE: { body: /^[01][0-9]{9}$/, hint: "BE, 10 digits starting with 0 or 1" },
  BG: { body: /^[0-9]{9,10}$/, hint: "BG, 9 or 10 digits" },
  CH: { body: /^E[0-9]{9}(MWST|TVA|IVA)?$/, hint: "CH, E, 9 digits and an optional MWST, TVA or IVA" },
  CY: { body: /^[0-9]{8}[A-Z]$/, hint: "CY, 8 digits and a letter" },
  CZ: { body: /^[0-9]{8,10}$/, hint: "CZ, 8, 9 or 10 digits" },
  DE: { body: /^[0-9]{9}$/, hint: "DE, 9 digits" },
  DK: { body: /^[0-9]{8}$/, hint: "DK, 8 digits" },
  EE: { body: /^[0-9]{9}$/, hint: "EE, 9 digits" },
  EL: { body: /^[0-9]{9}$/, hint: "EL, 9 digits" },
  ES: { body: /^[A-Z0-9][0-9]{7}[A-Z0-9]$/, hint: "ES, 9 characters" },
  FI: { body: /^[0-9]{8}$/, hint: "FI, 8 digits" },
  FR: { body: /^[A-Z0-9]{2}[0-9]{9}$/, hint: "FR, 2 characters and 9 digits" },
  GB: { body: /^([0-9]{9}|[0-9]{12}|GD[0-9]{3}|HA[0-9]{3})$/, hint: "GB, 9 or 12 digits, or GD or HA and 3 digits" },
  HR: { body: /^[0-9]{11}$/, hint: "HR, 11 digits" },
  HU: { body: /^[0-9]{8}$/, hint: "HU, 8 digits" },
  IE: { body: /^[0-9][A-Z*+][0-9]{5}[A-Z]{1,2}$/, hint: "IE, 8 or 9 characters" },
  IT: { body: /^[0-9]{11}$/, hint: "IT, 11 digits" },
  LT: { body: /^([0-9]{9}|[0-9]{12})$/, hint: "LT, 9 or 12 digits" },
  LU: { body: /^[0-9]{8}$/, hint: "LU, 8 digits" },
  LV: { body: /^[0-9]{11}$/, hint: "LV, 11 digits" },
  MT: { body: /^[0-9]{8}$/, hint: "MT, 8 digits" },
  NL: { body: /^[0-9]{9}B[0-9]{2}$/, hint: "NL, 9 digits, B and 2 digits" },
  NO: { body: /^[0-9]{9}MVA$/, hint: "NO, 9 digits and MVA" },
  PL: { body: /^[0-9]{10}$/, hint: "PL, 10 digits" },
  PT: { body: /^[0-9]{9}$/, hint: "PT, 9 digits" },
  RO: { body: /^[0-9]{2,10}$/, hint: "RO, 2 to 10 digits" },
  SE: { body: /^[0-9]{12}$/, hint: "SE, 12 digits" },
  SI: { body: /^[0-9]{8}$/, hint: "SI, 8 digits" },
  SK: { body: /^[0-9]{10}$/, hint: "SK, 10 digits" },
  XI: { body: /^([0-9]{9}|[0-9]{12}|GD[0-9]{3}|HA[0-9]{3})$/, hint: "XI, 9 or 12 digits, or GD or HA and 3 digits" },
};

export function validateVat(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "EU/EFTA VAT number format (per country)";
  const match = /^([A-Z]{2})([A-Z0-9]+)$/.exec(n);
  if (!match) {
    return make("vat", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "vat must start with a two-letter country code, for example DE123456789",
    });
  }
  const prefix = match[1];
  const spec = VAT_BODY[prefix === "GR" ? "EL" : prefix];
  if (!spec) {
    return make("vat", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: `no EU or EFTA vat format known for country ${prefix}`,
    });
  }
  const format = spec.body.test(match[2]);
  return make("vat", raw, n, algorithm, format, {
    checks: { format, length: format, checkDigit: null },
    country: prefix,
    reason: format ? null : `vat number must be ${spec.hint}`,
  });
}

export function validateEori(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "EORI format (country code plus customs identifier)";
  if (!/^[A-Z]{2}[A-Z0-9]{1,15}$/.test(n)) {
    return make("eori", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "eori must be a two-letter country code followed by 1 to 15 alphanumeric characters",
    });
  }
  const country = n.slice(0, 2);
  const countryOk = ISO_COUNTRIES.has(country);
  return make("eori", raw, n, algorithm, countryOk, {
    checks: { format: true, length: true, checkDigit: null },
    country,
    reason: countryOk ? null : `unknown eori country code ${country}`,
  });
}

const CUSIP_VALUES: Record<string, number> = { "*": 36, "@": 37, "#": 38 };
const SEDOL_WEIGHTS = [1, 3, 1, 7, 3, 9, 1];
const FIGI_VOWELS = /[AEIOU]/;

const normalizeCusip = (raw: string): string =>
  raw.trim().toUpperCase().replace(/[^0-9A-Z*@#]/g, "");

function alnumValue(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (CUSIP_VALUES[ch] !== undefined) return CUSIP_VALUES[ch];
  return code - 55;
}

function digitSum(value: number): number {
  let sum = 0;
  for (const ch of String(value)) sum += ch.charCodeAt(0) - 48;
  return sum;
}

function weightedDigitSumCheckDigit(body: string, weights: number[]): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += digitSum(alnumValue(body[i]) * weights[i]);
  return String((10 - (sum % 10)) % 10);
}

export function validateCusip(raw: string): ValidationResult {
  const n = normalizeCusip(raw);
  const algorithm = "CUSIP mod-10 with digit summing";
  if (!/^[0-9A-Z*@#]{8}[0-9]$/.test(n)) {
    return make("cusip", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "cusip must be 8 alphanumeric characters plus a numeric check digit",
    });
  }
  const expected = weightedDigitSumCheckDigit(n.slice(0, 8), [1, 2, 1, 2, 1, 2, 1, 2]);
  const provided = n[8];
  const checkDigit = provided === expected;
  return make("cusip", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateSedol(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "SEDOL mod-10 (weights 1,3,1,7,3,9,1)";
  if (!/^[0-9A-Z]{6}[0-9]$/.test(n)) {
    return make("sedol", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "sedol must be 6 alphanumeric characters plus a numeric check digit",
    });
  }
  let body = 0;
  for (let i = 0; i < 6; i++) body += alnumValue(n[i]) * SEDOL_WEIGHTS[i];
  const expected = String((10 - (body % 10)) % 10);
  const provided = n[6];
  const checkDigit = provided === expected;
  return make("sedol", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateFigi(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "FIGI mod-10 with digit summing";
  const shaped =
    /^[A-Z0-9]{12}$/.test(n) &&
    n[2] === "G" &&
    !FIGI_VOWELS.test(n.slice(0, 11)) &&
    DIGITS.test(n[11]);
  if (!shaped) {
    return make("figi", raw, n, algorithm, false, {
      checks: { format: false, length: n.length === 12, checkDigit: null },
      reason:
        "figi must be 12 characters: a consonant prefix, G, 8 consonants or digits, then a numeric check digit",
    });
  }
  const expected = weightedDigitSumCheckDigit(
    n.slice(0, 11),
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  );
  const provided = n[11];
  const checkDigit = provided === expected;
  return make("figi", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateCas(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "CAS Registry mod-10 positional weights";
  if (!/^[1-9][0-9]{3,9}$/.test(n)) {
    return make("cas", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "cas must be 5 to 10 digits starting with a non-zero digit (hyphens optional)",
    });
  }
  const body = n.slice(0, -1);
  const reversed = body.split("").reverse();
  let sum = 0;
  for (let i = 0; i < reversed.length; i++) sum += (reversed[i].charCodeAt(0) - 48) * (i + 1);
  const expected = String(sum % 10);
  const provided = n[n.length - 1];
  const checkDigit = provided === expected;
  return make("cas", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export function validateIsni(raw: string): ValidationResult {
  const n = normalize(raw);
  const algorithm = "ISO 7064 MOD 11-2";
  if (!/^[0-9]{15}[0-9X]$/.test(n)) {
    return make("isni", raw, n, algorithm, false, {
      checks: { format: false, length: false, checkDigit: null },
      reason: "isni must be 16 characters (15 digits plus digit or X)",
    });
  }
  const r = mod11_2(n.slice(0, 15));
  const expected = r === 10 ? "X" : String(r);
  const provided = n[15];
  const checkDigit = provided === expected;
  return make("isni", raw, n, algorithm, checkDigit, {
    checks: { format: true, length: true, checkDigit },
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    reason: checkDigit ? null : "check digit mismatch",
  });
}

export type ValidatorEntry = {
  type: string;
  description: string;
  examples: string[];
  validate: (raw: string) => ValidationResult;
};

export const VALIDATORS: Record<string, ValidatorEntry> = {
  gtin: {
    type: "gtin",
    description: "GS1 GTIN-8/12/13/14 (EAN-8, UPC-A, EAN-13, GTIN-14)",
    examples: ["4006381333931", "036000291452"],
    validate: validateGtin,
  },
  ean: {
    type: "ean",
    description: "EAN-13 barcode number",
    examples: ["4006381333931"],
    validate: validateEan,
  },
  upc: {
    type: "upc",
    description: "UPC-A barcode number",
    examples: ["036000291452"],
    validate: validateUpc,
  },
  sscc: {
    type: "sscc",
    description: "GS1 SSCC-18 shipping container code",
    examples: ["123456789012345675"],
    validate: validateSscc,
  },
  isbn: {
    type: "isbn",
    description: "ISBN-10 or ISBN-13 book number",
    examples: ["0306406152", "9780306406157"],
    validate: validateIsbn,
  },
  issn: {
    type: "issn",
    description: "ISSN-8 serial publication number",
    examples: ["03785955"],
    validate: validateIssn,
  },
  isin: {
    type: "isin",
    description: "ISIN-12 security identifier",
    examples: ["US0378331005"],
    validate: validateIsin,
  },
  iban: {
    type: "iban",
    description: "IBAN bank account number (length table plus mod-97)",
    examples: ["DE89370400440532013000"],
    validate: validateIban,
  },
  lei: {
    type: "lei",
    description: "ISO 17442 Legal Entity Identifier",
    examples: ["529900IH9V4I3VHQVO92"],
    validate: validateLei,
  },
  vin: {
    type: "vin",
    description: "ISO 3779 vehicle identification number",
    examples: ["1HGCM82633A004352"],
    validate: validateVin,
  },
  imei: {
    type: "imei",
    description: "IMEI-15 mobile device identifier",
    examples: ["490154203237518"],
    validate: validateImei,
  },
  npi: {
    type: "npi",
    description: "US National Provider Identifier (CMS)",
    examples: ["1234567893"],
    validate: validateNpi,
  },
  aba: {
    type: "aba",
    description: "US ABA routing transit number",
    examples: ["021000021"],
    validate: validateAba,
  },
  orcid: {
    type: "orcid",
    description: "ORCID researcher identifier",
    examples: ["0000000218250097"],
    validate: validateOrcid,
  },
  iso6346: {
    type: "iso6346",
    description: "ISO 6346 shipping container code",
    examples: ["CSQU3054383"],
    validate: validateIso6346,
  },
  luhn: {
    type: "luhn",
    description: "Generic Luhn mod-10 checksum",
    examples: ["79927398713"],
    validate: validateLuhn,
  },
  bic: {
    type: "bic",
    description: "ISO 9362 BIC/SWIFT code with ISO 3166 country check",
    examples: ["DEUTDEFF", "DEUTDEFF500"],
    validate: validateBic,
  },
  rf: {
    type: "rf",
    description: "ISO 11649 RF creditor reference",
    examples: ["RF18539007547034"],
    validate: validateRf,
  },
  mrz: {
    type: "mrz",
    description: "ICAO 9303 TD3 machine readable zone line",
    examples: ["L898902C36UTO7408122F1204159ZE184226B<<<<<10"],
    validate: validateMrz,
  },
  vat: {
    type: "vat",
    description: "EU/EFTA VAT number format (country prefix plus national number)",
    examples: ["DE123456789", "ATU12345678", "CHE116281710MWST"],
    validate: validateVat,
  },
  eori: {
    type: "eori",
    description: "EORI customs number format",
    examples: ["DE123456789012345", "FR1234567890"],
    validate: validateEori,
  },
  cusip: {
    type: "cusip",
    description: "CUSIP-9 North American security identifier",
    examples: ["037833100", "594918104"],
    validate: validateCusip,
  },
  sedol: {
    type: "sedol",
    description: "SEDOL-7 UK and Ireland security identifier",
    examples: ["B0YBKJ7", "0263494"],
    validate: validateSedol,
  },
  figi: {
    type: "figi",
    description: "FIGI-12 financial instrument global identifier",
    examples: ["BBG000BLNNV0", "BBG000BLNQ16"],
    validate: validateFigi,
  },
  cas: {
    type: "cas",
    description: "CAS Registry number (chemical substances)",
    examples: ["7732-18-5", "50-00-0"],
    validate: validateCas,
  },
  isni: {
    type: "isni",
    description: "ISNI-16 international standard name identifier",
    examples: ["0000000121032683"],
    validate: validateIsni,
  },
};

export function validate(type: string, value: string): ValidationResult {
  const entry = VALIDATORS[type];
  if (!entry) throw new Error(`unsupported type '${type}'`);
  return entry.validate(value);
}

export function supportedTypes(): string[] {
  return Object.keys(VALIDATORS);
}

export type CompletionResult = {
  type: string;
  body: string;
  normalized: string;
  checkDigit: string;
  complete: string;
  algorithm: string;
};

const COMPLETION_ALGORITHMS: Record<string, string> = {
  gtin: "GS1 mod-10 (weights 3,1)",
  ean: "GS1 mod-10 (weights 3,1)",
  upc: "GS1 mod-10 (weights 3,1)",
  sscc: "GS1 mod-10 (weights 3,1)",
  isbn: "ISBN-10 mod-11 / ISBN-13 mod-10",
  issn: "ISSN mod-11 (weights 8..2)",
  isin: "Luhn mod-10 (letters expanded A=10)",
  imei: "Luhn mod-10",
  npi: "Luhn mod-10 with 80840 prefix",
  aba: "ABA mod-10 (weights 3,7,1)",
  orcid: "ISO 7064 MOD 11-2",
  iso6346: "ISO 6346 mod-11",
  lei: "ISO 17442 mod-97-10",
  iban: "ISO 13616 mod-97-10",
  luhn: "Luhn mod-10",
  rf: "ISO 11649 mod-97-10",
  cusip: "CUSIP mod-10 with digit summing",
  sedol: "SEDOL mod-10 (weights 1,3,1,7,3,9,1)",
  figi: "FIGI mod-10 with digit summing",
  cas: "CAS Registry mod-10 positional weights",
  isni: "ISO 7064 MOD 11-2",
};

export function completableTypes(): string[] {
  return Object.keys(COMPLETION_ALGORITHMS);
}

export function completeCheckDigit(type: string, rawBody: string): CompletionResult {
  const algorithm = COMPLETION_ALGORITHMS[type];
  if (!algorithm) throw new Error(`unsupported type '${type}'`);
  const n = type === "cusip" ? normalizeCusip(rawBody) : normalize(rawBody);
  let checkDigit: string;
  switch (type) {
    case "gtin":
      if (![7, 11, 12, 13].includes(n.length) || !DIGITS.test(n))
        throw new Error("gtin body must be 7, 11, 12 or 13 digits");
      checkDigit = String(mod10CheckDigit(n));
      break;
    case "ean":
      if (n.length !== 12 || !DIGITS.test(n)) throw new Error("ean body must be 12 digits");
      checkDigit = String(mod10CheckDigit(n));
      break;
    case "upc":
      if (n.length !== 11 || !DIGITS.test(n)) throw new Error("upc body must be 11 digits");
      checkDigit = String(mod10CheckDigit(n));
      break;
    case "sscc":
      if (n.length !== 17 || !DIGITS.test(n)) throw new Error("sscc body must be 17 digits");
      checkDigit = String(mod10CheckDigit(n));
      break;
    case "luhn":
      if (!DIGITS.test(n)) throw new Error("luhn body must be digits");
      checkDigit = String(luhnCheckDigit(n));
      break;
    case "imei":
      if (n.length !== 14 || !DIGITS.test(n)) throw new Error("imei body must be 14 digits");
      checkDigit = String(luhnCheckDigit(n));
      break;
    case "npi":
      if (!/^[12][0-9]{8}$/.test(n))
        throw new Error("npi body must be 9 digits starting with 1 or 2");
      checkDigit = String(luhnCheckDigit("80840" + n));
      break;
    case "isin":
      if (!/^[A-Z]{2}[A-Z0-9]{9}$/.test(n))
        throw new Error("isin body must be 2 letters plus 9 alphanumeric characters");
      checkDigit = String(luhnCheckDigit(expandAlpha(n)));
      break;
    case "isbn": {
      if (n.length === 9 && DIGITS.test(n)) {
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += (n.charCodeAt(i) - 48) * (10 - i);
        const r = (11 - (sum % 11)) % 11;
        checkDigit = r === 10 ? "X" : String(r);
      } else if (/^97[89][0-9]{9}$/.test(n)) {
        checkDigit = String(mod10CheckDigit(n));
      } else {
        throw new Error(
          "isbn body must be 9 digits (ISBN-10) or 12 digits starting with 978 or 979 (ISBN-13)",
        );
      }
      break;
    }
    case "issn": {
      if (n.length !== 7 || !DIGITS.test(n)) throw new Error("issn body must be 7 digits");
      let sum = 0;
      for (let i = 0; i < 7; i++) sum += (n.charCodeAt(i) - 48) * (8 - i);
      const r = (11 - (sum % 11)) % 11;
      checkDigit = r === 10 ? "X" : String(r);
      break;
    }
    case "aba": {
      if (n.length !== 8 || !DIGITS.test(n)) throw new Error("aba body must be 8 digits");
      let sum = 0;
      for (let i = 0; i < 8; i++) sum += (n.charCodeAt(i) - 48) * ABA_WEIGHTS[i];
      checkDigit = String((10 - (sum % 10)) % 10);
      break;
    }
    case "orcid": {
      if (n.length !== 15 || !DIGITS.test(n)) throw new Error("orcid body must be 15 digits");
      const r = mod11_2(n);
      checkDigit = r === 10 ? "X" : String(r);
      break;
    }
    case "iso6346": {
      if (!/^[A-Z]{4}[0-9]{6}$/.test(n))
        throw new Error("iso6346 body must be 4 letters plus 6 digits");
      let sum = 0;
      for (let i = 0; i < 10; i++) {
        const ch = n[i];
        const value = ch >= "0" && ch <= "9" ? ch.charCodeAt(0) - 48 : CONTAINER_VALUES[ch];
        sum += value * Math.pow(2, i);
      }
      const r = sum % 11;
      checkDigit = String(r === 10 ? 0 : r);
      break;
    }
    case "lei": {
      if (!/^[A-Z0-9]{18}$/.test(n)) throw new Error("lei body must be 18 alphanumeric characters");
      checkDigit = String(98 - mod97(expandAlpha(n) + "00")).padStart(2, "0");
      break;
    }
    case "iban": {
      if (!/^[A-Z]{2}[A-Z0-9]{1,30}$/.test(n))
        throw new Error("iban body must be a 2-letter country code followed by the BBAN");
      const country = n.slice(0, 2);
      const expected = IBAN_LENGTHS[country];
      if (expected !== undefined && n.length !== expected - 2)
        throw new Error(
          `country ${country} requires ${expected} characters total, so the body must be ${expected - 2}`,
        );
      checkDigit = String(98 - mod97(expandAlpha(n.slice(2) + country + "00"))).padStart(2, "0");
      break;
    }
    case "rf": {
      if (!/^[0-9A-Z]{1,21}$/.test(n))
        throw new Error("rf body must be up to 21 alphanumeric characters");
      checkDigit = String(98 - mod97(expandAlpha(n + "RF00"))).padStart(2, "0");
      break;
    }
    case "cusip": {
      if (!/^[0-9A-Z*@#]{8}$/.test(n))
        throw new Error("cusip body must be 8 alphanumeric characters");
      checkDigit = weightedDigitSumCheckDigit(n, [1, 2, 1, 2, 1, 2, 1, 2]);
      break;
    }
    case "sedol": {
      if (!/^[0-9A-Z]{6}$/.test(n)) throw new Error("sedol body must be 6 alphanumeric characters");
      let sum = 0;
      for (let i = 0; i < 6; i++) sum += alnumValue(n[i]) * SEDOL_WEIGHTS[i];
      checkDigit = String((10 - (sum % 10)) % 10);
      break;
    }
    case "figi": {
      if (
        !/^[A-Z0-9]{11}$/.test(n) ||
        n[2] !== "G" ||
        FIGI_VOWELS.test(n)
      )
        throw new Error(
          "figi body must be 11 characters: a consonant prefix, G and 8 consonants or digits",
        );
      checkDigit = weightedDigitSumCheckDigit(
        n,
        [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
      );
      break;
    }
    case "cas": {
      if (!/^[1-9][0-9]{3,9}$/.test(n))
        throw new Error("cas body must be 4 to 9 digits starting with a non-zero digit");
      const reversed = n.split("").reverse();
      let sum = 0;
      for (let i = 0; i < reversed.length; i++) sum += (reversed[i].charCodeAt(0) - 48) * (i + 1);
      checkDigit = String(sum % 10);
      break;
    }
    case "isni": {
      if (n.length !== 15 || !DIGITS.test(n)) throw new Error("isni body must be 15 digits");
      const r = mod11_2(n);
      checkDigit = r === 10 ? "X" : String(r);
      break;
    }
    default:
      throw new Error(`unsupported type '${type}'`);
  }
  const complete =
    type === "iban"
      ? n.slice(0, 2) + checkDigit + n.slice(2)
      : type === "rf"
        ? "RF" + checkDigit + n
        : n + checkDigit;
  return { type, body: rawBody, normalized: n, checkDigit, complete, algorithm };
}
