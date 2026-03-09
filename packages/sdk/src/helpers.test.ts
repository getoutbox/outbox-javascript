import { describe, expect, it } from "vitest";
import { parse, textContent, textPart, verify } from "./helpers.js";

// Helper: compute a valid HMAC-SHA256 hex signature using the same algorithm as verify()
async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// -------------------------
// textPart
// -------------------------

describe("textPart", () => {
  it("produces a text/plain part with UTF-8 encoded content", () => {
    const part = textPart("hello");
    expect(part.contentType).toBe("text/plain");
    if (!("content" in part)) {
      throw new Error("expected content part");
    }
    expect(new TextDecoder().decode(part.content)).toBe("hello");
  });

  it("handles an empty string", () => {
    const part = textPart("");
    expect(part.contentType).toBe("text/plain");
    if (!("content" in part)) {
      throw new Error("expected content part");
    }
    expect(part.content).toBeDefined();
    expect(new TextDecoder().decode(part.content)).toBe("");
  });

  it("encodes multi-byte unicode (emoji) correctly", () => {
    const text = "Hello 👋 World 🌍";
    expect(textContent(textPart(text))).toBe(text);
  });

  it("encodes CJK characters correctly", () => {
    const text = "你好世界";
    expect(textContent(textPart(text))).toBe(text);
  });

  it("encodes accented latin characters correctly", () => {
    const text = "Café résumé naïve";
    expect(textContent(textPart(text))).toBe(text);
  });
});

// -------------------------
// textContent
// -------------------------

describe("textContent", () => {
  it("round-trips with textPart", () => {
    expect(textContent(textPart("world"))).toBe("world");
  });

  it("throws when part has no content (url variant)", () => {
    const urlPart = { contentType: "text/plain", url: "https://example.com" };
    expect(() => textContent(urlPart)).toThrow("MessagePart has no content");
  });

  it("decodes empty byte array to empty string", () => {
    const part = { contentType: "text/plain", content: new Uint8Array([]) };
    expect(textContent(part)).toBe("");
  });

  it("decodes valid multi-byte UTF-8 sequence", () => {
    // UTF-8 encoding of "é" is 0xC3 0xA9
    const part = {
      contentType: "text/plain",
      content: new Uint8Array([0xc3, 0xa9]),
    };
    expect(textContent(part)).toBe("é");
  });
});

// -------------------------
// parse — JSON body
// -------------------------

describe("parse — JSON body", () => {
  it("parses a message delivery event", () => {
    const event = parse({
      connector: "connectors/abc",
      message: {
        name: "messages/msg1",
        recipient: "accounts/rec1",
        parts: [],
        metadata: {},
        direction: 1,
        scope: 0,
        editNumber: "0",
      },
    });
    expect(event.type).toBe("message");
    if (event.type === "message") {
      expect(event.connectorId).toBe("abc");
      expect(event.message.id).toBe("msg1");
    }
  });

  it("parses a delivery event with no known event type as 'unknown'", () => {
    const event = parse({ connector: "connectors/abc" });
    expect(event.type).toBe("unknown");
    expect(event.connectorId).toBe("abc");
  });

  it("handles editNumber as a string (proto uint64 JSON encoding)", () => {
    const event = parse({
      connector: "connectors/abc",
      message: {
        name: "messages/msg2",
        recipient: "accounts/rec1",
        parts: [],
        metadata: {},
        direction: 2,
        scope: 0,
        editNumber: "5",
      },
    });
    expect(event.type).toBe("message");
    if (event.type === "message") {
      expect(event.message.editNumber).toBe(5);
    }
  });
});

// -------------------------
// parse — binary body
// -------------------------

describe("parse — binary body", () => {
  it("parses a proto-binary delivery event", async () => {
    const { create, toBinary } = await import("@bufbuild/protobuf");
    const { DeliveryEventSchema } = await import(
      "./gen/outbox/v1/destination_pb.js"
    );

    // Create a minimal DeliveryEvent (no event case = unknown type)
    const protoEvent = create(DeliveryEventSchema, {
      connector: "connectors/bin1",
    });
    const bytes = toBinary(DeliveryEventSchema, protoEvent);

    const event = parse(bytes);
    expect(event.type).toBe("unknown");
    expect(event.connectorId).toBe("bin1");
  });
});

// -------------------------
// verify
// -------------------------

describe("verify", () => {
  it("returns true for a valid HMAC-SHA256 signature", async () => {
    const body = '{"connector":"connectors/abc"}';
    const secret = "mysecret";
    const sig = await sign(body, secret);

    const result = await verify({
      body: new TextEncoder().encode(body),
      secret,
      signature: sig,
    });
    expect(result).toBe(true);
  });

  it("returns false for an all-zero (invalid) signature", async () => {
    const result = await verify({
      body: new TextEncoder().encode("anything"),
      secret: "mysecret",
      signature: "0".repeat(64),
    });
    expect(result).toBe(false);
  });

  it("returns false when body has been tampered with", async () => {
    const original = '{"connector":"connectors/abc"}';
    const tampered = '{"connector":"connectors/xyz"}';
    const secret = "mysecret";
    const sig = await sign(original, secret);

    const result = await verify({
      body: new TextEncoder().encode(tampered),
      secret,
      signature: sig,
    });
    expect(result).toBe(false);
  });

  it("returns false when wrong secret is used", async () => {
    const body = '{"connector":"connectors/abc"}';
    const sig = await sign(body, "secret-a");

    const result = await verify({
      body: new TextEncoder().encode(body),
      secret: "secret-b",
      signature: sig,
    });
    expect(result).toBe(false);
  });

  it("returns false for empty signature string", async () => {
    const result = await verify({
      body: new TextEncoder().encode("anything"),
      secret: "mysecret",
      signature: "",
    });
    expect(result).toBe(false);
  });

  it("returns false for non-hex characters in signature", async () => {
    const result = await verify({
      body: new TextEncoder().encode("anything"),
      secret: "mysecret",
      signature: "Z".repeat(64),
    });
    expect(result).toBe(false);
  });
});
