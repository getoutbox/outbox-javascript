import { describe, expect, it } from "vitest";
import { deriveFieldMask } from "./field-mask.js";

describe("deriveFieldMask", () => {
  it("returns empty paths for an empty object", () => {
    expect(deriveFieldMask({})).toEqual({ paths: [] });
  });

  it("converts camelCase keys to snake_case", () => {
    expect(deriveFieldMask({ displayName: "foo" })).toEqual({
      paths: ["display_name"],
    });
  });

  it("handles consecutive uppercase in camelCase", () => {
    expect(deriveFieldMask({ channelConfig: {} })).toEqual({
      paths: ["channel_config"],
    });
  });

  it("skips keys with undefined values", () => {
    expect(deriveFieldMask({ displayName: "foo", filter: undefined })).toEqual({
      paths: ["display_name"],
    });
  });

  it("skips id unconditionally even when defined", () => {
    expect(deriveFieldMask({ id: "abc", displayName: "foo" })).toEqual({
      paths: ["display_name"],
    });
  });

  it("skips requestId unconditionally even when defined", () => {
    expect(deriveFieldMask({ requestId: "req1", displayName: "foo" })).toEqual({
      paths: ["display_name"],
    });
  });

  it("includes multiple fields in input order", () => {
    const result = deriveFieldMask({
      displayName: "foo",
      eventTypes: [1, 2],
      payloadFormat: 1,
    });
    expect(result.paths).toEqual([
      "display_name",
      "event_types",
      "payload_format",
    ]);
  });

  it("includes field when value is 0 (falsy number)", () => {
    expect(deriveFieldMask({ payloadFormat: 0 })).toEqual({
      paths: ["payload_format"],
    });
  });

  it("includes field when value is false", () => {
    expect(deriveFieldMask({ tlsEnabled: false })).toEqual({
      paths: ["tls_enabled"],
    });
  });

  it("includes field when value is empty string", () => {
    expect(deriveFieldMask({ filter: "" })).toEqual({
      paths: ["filter"],
    });
  });

  it("includes field when value is empty array", () => {
    expect(deriveFieldMask({ eventTypes: [] })).toEqual({
      paths: ["event_types"],
    });
  });
});
