# outbox-javascript

JavaScript/TypeScript SDK monorepo for [Outbox](https://outbox.chat) — a unified messaging API for AI agents.

Send and receive messages across channels (Slack, WhatsApp, and more) with a single API.

## Packages

| Package | Description |
|---------|-------------|
| [`@outbox-sdk/outbox`](packages/sdk/) | Outbox client SDK for Node.js, Deno, and browsers |

## Getting started

See the SDK package for installation and usage: [`packages/sdk/`](packages/sdk/).

## Development

This monorepo uses [pnpm](https://pnpm.io) and [Turborepo](https://turbo.build/repo).

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Examples

See the [`examples/`](examples/) directory for integration examples with:

Cloudflare Workers, EventBridge, Google Pub/Sub, Hatchet, Inngest, Kafka, Lambda, NATS, Restate, SNS, SQS, Temporal, Webhooks

## License

MIT
