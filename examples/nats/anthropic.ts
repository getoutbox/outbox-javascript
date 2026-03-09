import Anthropic from "@anthropic-ai/sdk";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import { connect, JSONCodec } from "nats";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const SUBJECT = process.env.NATS_SUBJECT ?? "outbox.events";

async function main(): Promise<void> {
  await outbox.destinations.create({
    destinationId: "nats-anthropic",
    displayName: "NATS Anthropic agent",
    target: {
      case: "nats",
      value: { url: NATS_URL, subject: SUBJECT },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });

  const nc = await connect({ servers: NATS_URL });
  const jc = JSONCodec<Record<string, unknown>>();
  const sub = nc.subscribe(SUBJECT);

  for await (const msg of sub) {
    try {
      await processMessage(jc.decode(msg.data));
    } catch (err) {
      console.error("Failed to process message:", err);
    }
  }
}

async function processMessage(payload: Record<string, unknown>): Promise<void> {
  const event = parse(payload);
  if (event.type !== "message") {
    return;
  }

  const { connectorId, message } = event;
  const accountId = message.account!.id;

  await outbox.messages.markRead({
    connectorId,
    accountId,
    messages: [message.id],
  });

  const { items } = await outbox.messages.history({
    connectorId,
    accountId,
    pageSize: 20,
  });
  const chatMessages = items.map((m) => ({
    role: (m.direction === MessageDirection.INBOUND ? "user" : "assistant") as
      | "user"
      | "assistant",
    content: textContent(m.parts[0]),
  }));

  const reply = await outbox.messages.withTyping(
    { connectorId, accountId },
    async () => {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: chatMessages,
      });
      return res.content[0].type === "text" ? res.content[0].text : "";
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}

main().catch(console.error);
