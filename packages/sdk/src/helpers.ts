import type { JsonValue } from "@bufbuild/protobuf";
import { fromBinary, fromJson } from "@bufbuild/protobuf";
import { DeliveryEventSchema } from "./gen/outbox/v1/destination_pb.js";
import { mapDeliveryEvent } from "./internal/mappers.js";
import type { DeliveryEvent, MessagePart } from "./types.js";

/**
 * Creates a text/plain MessagePart from a string.
 */
export function textPart(text: string): MessagePart {
  return {
    contentType: "text/plain",
    content: new TextEncoder().encode(text),
  };
}

/**
 * Decodes a MessagePart's content bytes to a UTF-8 string.
 * Throws if the part has no content.
 */
export function textContent(part: MessagePart): string {
  if (!("content" in part)) {
    throw new Error("MessagePart has no content");
  }
  return new TextDecoder().decode(part.content);
}

/**
 * Parses a delivery payload into a typed {@link DeliveryEvent}.
 *
 * Accepts either a proto-binary `Uint8Array` / `Buffer` or a pre-decoded
 * JSON object. Check `event.type` to discriminate the variant:
 *
 * ```ts
 * const event = parse(body);
 * if (event.type !== "message") return;
 * const { connectorId, message } = event;
 * ```
 */
export function parse(body: object | Uint8Array): DeliveryEvent {
  if (body instanceof Uint8Array) {
    return mapDeliveryEvent(fromBinary(DeliveryEventSchema, body));
  }
  return mapDeliveryEvent(
    fromJson(DeliveryEventSchema, body as JsonValue, {
      ignoreUnknownFields: true,
    })
  );
}

// --- Delivery verification ---

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verifies a delivery signature using HMAC-SHA256.
 * Uses `globalThis.crypto.subtle` so it works in Node, Deno, Cloudflare Workers, and browsers.
 *
 * @returns `true` if the signature is valid, `false` otherwise.
 */
export async function verify(options: {
  body: BufferSource;
  secret: string;
  signature: string;
}): Promise<boolean> {
  const { body, secret, signature } = options;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(signature) as Uint8Array<ArrayBuffer>,
    body
  );
}
