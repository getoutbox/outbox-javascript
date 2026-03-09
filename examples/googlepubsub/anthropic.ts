import Anthropic from "@anthropic-ai/sdk";
import { PubSub } from "@google-cloud/pubsub";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID! });
const subscription = pubsub.subscription(
  process.env.PUBSUB_SUBSCRIPTION ?? "outbox-events-sub"
);

await outbox.destinations.create({
  destinationId: "pubsub-anthropic",
  displayName: "Pub/Sub Anthropic agent",
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
