import { describe, expect, it } from "vitest";
import app from "../src/index";

const dev = { DEV_MODE: "1" };

describe("routes", () => {
  it("serves health without auth", async () => {
    const res = await app.request("/v1/health", {}, dev);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("serves the type catalogue without auth", async () => {
    const res = await app.request("/v1/types", {}, dev);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number };
    expect(body.count).toBeGreaterThan(10);
  });

  it("rejects unauthenticated validation when dev mode is off", async () => {
    const res = await app.request("/v1/validate/gtin/4006381333931", {}, { DEV_MODE: "0" });
    expect(res.status).toBe(401);
  });

  it("accepts a matching x-api-key", async () => {
    const res = await app.request(
      "/v1/validate/gtin/4006381333931",
      { headers: { "x-api-key": "s3cret" } },
      { DEV_MODE: "0", API_KEY: "s3cret" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  it("accepts the rapidapi proxy secret", async () => {
    const res = await app.request(
      "/v1/validate/ean/4006381333931",
      { headers: { "x-rapidapi-proxy-secret": "proxy" } },
      { DEV_MODE: "0", RAPIDAPI_SECRET: "proxy" },
    );
    expect(res.status).toBe(200);
  });

  it("runs a batch", async () => {
    const res = await app.request(
      "/v1/validate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [
            { type: "ean", value: "4006381333931" },
            { type: "unsupported", value: "1" },
          ],
        }),
      },
      dev,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; results: Array<{ valid: boolean }> };
    expect(body.count).toBe(2);
    expect(body.results[1].valid).toBe(false);
  });

  it("rejects oversized batches", async () => {
    const items = Array.from({ length: 101 }, () => ({ type: "ean", value: "4006381333931" }));
    const res = await app.request(
      "/v1/validate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      },
      dev,
    );
    expect(res.status).toBe(413);
  });

  it("rejects oversized values on the single endpoint", async () => {
    const res = await app.request(`/v1/validate/luhn/${"1".repeat(500)}`, {}, dev);
    expect(res.status).toBe(413);
  });

  it("rejects oversized values inside a batch", async () => {
    const res = await app.request(
      "/v1/validate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ type: "luhn", value: "1".repeat(500) }] }),
      },
      dev,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ error?: string }> };
    expect(body.results[0].error).toBe("value_too_long");
  });

  it("serves a landing page to browsers and JSON otherwise", async () => {
    const html = await app.request("/", { headers: { accept: "text/html" } }, dev);
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(await html.text()).toContain("CodeCheck");

    const json = await app.request("/", {}, dev);
    expect(json.headers.get("content-type")).toContain("application/json");
  });

  it("completes a check digit when authorised", async () => {
    const res = await app.request("/v1/complete/gtin/400638133393", {}, dev);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkDigit: string; complete: string };
    expect(body.checkDigit).toBe("1");
    expect(body.complete).toBe("4006381333931");
  });

  it("rejects an invalid completion body", async () => {
    const res = await app.request("/v1/complete/gtin/123", {}, dev);
    expect(res.status).toBe(422);
  });

  it("rejects completion for types without a trailing check digit", async () => {
    const res = await app.request("/v1/complete/vin/1HGCM82633A00435", {}, dev);
    expect(res.status).toBe(400);
  });

  it("requires auth for completion", async () => {
    const res = await app.request("/v1/complete/gtin/400638133393", {}, { DEV_MODE: "0" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown types", async () => {
    const res = await app.request("/v1/validate/nope/1", {}, dev);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await app.request("/nope", {}, dev);
    expect(res.status).toBe(404);
  });
});
