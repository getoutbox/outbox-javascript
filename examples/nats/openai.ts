import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import { connect, JSONCodec } from "nats";
import OpenAI from "openai";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const SUBJECT = process.env.NATS_SUBJECT ?? "outbox.events";

async function main(): Promise<void> {
  await outbox.destinations.create({
    destinationId: "nats-openai",
    displayName: "NATS OpenAI agent",
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
      const res = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: chatMessages,
      });
      return res.choices[0].message.content ?? "";
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}

main().catch(console.error);
