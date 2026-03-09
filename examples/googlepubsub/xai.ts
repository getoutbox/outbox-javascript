import { PubSub } from "@google-cloud/pubsub";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import OpenAI from "openai";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});

const pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID! });
const subscription = pubsub.subscription(
  process.env.PUBSUB_SUBSCRIPTION ?? "outbox-events-sub"
);

await outbox.destinations.create({
  destinationId: "pubsub-xai",
  displayName: "Pub/Sub xAI agent",
  target: {
    case: "googlePubSub",
    value: {
      projectId: process.env.GOOGLE_PROJECT_ID!,
      topicId: "outbox-events",
    },
  },
  eventTypes: [DestinationEventType.MESSAGE],
});

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
      const res = await xai.chat.completions.create({
        model: "grok-4",
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

subscription.on("message", async (message) => {
  try {
    const payload = JSON.parse(message.data.toString()) as Record<
      string,
      unknown
    >;
    await processMessage(payload);
  } catch (err) {
    console.error("Failed to process message:", err);
  } finally {
    message.ack();
  }
});

subscription.on("error", (err) => {
  console.error("Subscription error:", err);
});
