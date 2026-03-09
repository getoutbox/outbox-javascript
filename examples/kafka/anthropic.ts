import Anthropic from "@anthropic-ai/sdk";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import { Kafka } from "kafkajs";

// --- Initialize clients ---
const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// --- Configure Kafka consumer ---
const kafka = new Kafka({
  clientId: "outbox-agent",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});
const consumer = kafka.consumer({ groupId: "outbox-agent" });

async function main(): Promise<void> {
  // --- Register the destination ---
  await outbox.destinations.create({
    destinationId: "kafka-agent",
    displayName: "Kafka agent",
    target: {
      case: "kafka",
      value: {
        brokers: process.env.KAFKA_BROKERS ?? "localhost:9092",
        topic: process.env.KAFKA_TOPIC ?? "outbox-events",
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });

  // --- Connect and subscribe ---
  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.KAFKA_TOPIC ?? "outbox-events",
    fromBeginning: false,
  });

  // --- Consume messages ---
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value!.toString()) as Record<
          string,
          unknown
        >;

        // --- Parse the event ---
        const event = parse(payload);
        if (event.type !== "message") {
          return;
        }
        const { connectorId, message: msg } = event;
        const accountId = msg.account!.id;

        // --- Acknowledge the message ---
        await outbox.messages.markRead({
          connectorId,
          accountId,
          messages: [msg.id],
        });

        // --- Fetch conversation history ---
        const { items } = await outbox.messages.history({
          connectorId,
          accountId,
          pageSize: 20,
        });
        const chatMessages = items.map((m) => ({
          role: (m.direction === MessageDirection.INBOUND
            ? "user"
            : "assistant") as "user" | "assistant",
          content: textContent(m.parts[0]),
        }));

        // --- Generate a reply ---
        const reply = await outbox.messages.withTyping(
          { connectorId, accountId },
          async () => {
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              messages: chatMessages,
            });
            return response.content[0].type === "text"
              ? response.content[0].text
              : "";
          }
        );

        // --- Send the reply ---
        await outbox.messages.send({
          connectorId,
          recipientId: accountId,
          parts: [textPart(reply)],
        });
      } catch (err) {
        console.error("Failed to process message:", err);
      }
    },
  });
}

main().catch(console.error);
