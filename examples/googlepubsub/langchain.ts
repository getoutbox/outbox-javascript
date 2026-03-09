import { PubSub } from "@google-cloud/pubsub";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const llm = new ChatOpenAI({ model: "gpt-5.2" });

const pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID! });
const subscription = pubsub.subscription(
  process.env.PUBSUB_SUBSCRIPTION ?? "outbox-events-sub"
);

await outbox.destinations.create({
  destinationId: "pubsub-langchain",
  displayName: "Pub/Sub LangChain agent",
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
  const msgs = items.map((m) =>
    m.direction === MessageDirection.INBOUND
      ? new HumanMessage(textContent(m.parts[0]))
      : new AIMessage(textContent(m.parts[0]))
  );

  const reply = await outbox.messages.withTyping(
    { connectorId, accountId },
    async () => {
      const res = await llm.invoke(msgs);
      return res.content as string;
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
