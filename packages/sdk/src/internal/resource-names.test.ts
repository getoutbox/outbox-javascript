import { describe, expect, it } from "vitest";
import {
  accountName,
  connectorName,
  destinationName,
  messageName,
  parseId,
  templateName,
  templateParent,
} from "./resource-names.js";

describe("resource name constructors", () => {
  it("connectorName prefixes with connectors/", () => {
    expect(connectorName("abc")).toBe("connectors/abc");
  });

  it("destinationName prefixes with destinations/", () => {
    expect(destinationName("xyz")).toBe("destinations/xyz");
  });

  it("messageName prefixes with messages/", () => {
    expect(messageName("msg1")).toBe("messages/msg1");
  });

  it("accountName prefixes with accounts/", () => {
    expect(accountName("acc1")).toBe("accounts/acc1");
  });

  it("templateName builds connectors/<connectorId>/templates/<templateId>", () => {
    expect(templateName("conn1", "tmpl1")).toBe(
      "connectors/conn1/templates/tmpl1"
    );
  });

  it("templateParent builds connectors/<connectorId>", () => {
    expect(templateParent("conn1")).toBe("connectors/conn1");
  });
});

describe("parseId", () => {
  it("extracts the last segment from a two-part name", () => {
    expect(parseId("connectors/abc")).toBe("abc");
  });

  it("extracts the last segment from a multi-part name", () => {
    expect(parseId("a/b/c/def")).toBe("def");
  });

  it("returns the string itself when there is no slash", () => {
    expect(parseId("abc")).toBe("abc");
  });

  it("throws on an empty string", () => {
    expect(() => parseId("")).toThrow('Invalid resource name: ""');
  });

  it("throws on a trailing slash", () => {
    expect(() => parseId("connectors/")).toThrow("Invalid resource name");
  });
});
