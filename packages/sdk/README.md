# @outbox-sdk/outbox

JavaScript/TypeScript SDK for [Outbox](https://outbox.chat) — a unified messaging API for AI agents.

Send and receive messages across channels (Slack, WhatsApp, and more) with a single API. Works in Node.js, Deno, Cloudflare Workers, and browsers.

## Installation

```bash
npm install @outbox-sdk/outbox
```

## Quick start

```typescript
import { OutboxClient, textPart } from "@outbox-sdk/outbox";

const client = new OutboxClient({ apiKey: "ob_live_your_api_key" });

const result = await client.messages.send({
  connectorId: "conn123",
  recipientId: "acct456",
  parts: [textPart("Hello!")],
});

console.log("sent:", result.id);
```

## Services

The client exposes five namespaces:

| Namespace | Description |
|-----------|-------------|
| `client.connectors` | Create and manage connectors (one per channel account) |
| `client.accounts` | Look up or manage end-user accounts |
| `client.messages` | Send, update, delete, and list messages |
| `client.destinations` | Configure push targets for delivery events |
| `client.channels` | List available messaging channels |

## Webhook verification

Verify and parse incoming webhook payloads:

```typescript
import { verify, parse } from "@outbox-sdk/outbox";

const valid = await verify({
  body: rawBody,
  secret: signingSecret,
  signature: request.headers.get("X-Outbox-Signature")!,
});

if (!valid) {
  return new Response("Unauthorized", { status: 401 });
}

const event = parse(rawBody);

if (event.type === "message") {
  console.log("message from connector:", event.connectorId);
}
```

Signature verification uses `crypto.subtle` so it works across all JavaScript runtimes.

## Helpers

| Function | Description |
|----------|-------------|
| `textPart(text)` | Create a `text/plain` message part from a string |
| `textContent(part)` | Decode a message part's content bytes to a UTF-8 string |
| `parse(body)` | Parse a delivery event from binary or JSON |
| `verify({ body, secret, signature })` | Verify an HMAC-SHA256 webhook signature |
| `parseId(resourceName)` | Extract the plain ID from a resource name |

## Client options

```typescript
const client = new OutboxClient({
  apiKey: "ob_live_your_api_key",
  baseUrl: "https://custom-api.example.com",
});
```

## License

MIT
