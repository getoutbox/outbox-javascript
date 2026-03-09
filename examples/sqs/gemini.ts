// Step 1: imports and client initialisation
import { GoogleGenAI } from "@google/genai";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// Step 2: register the destination once so Outbox knows where to deliver events.
// Upsert semantics make it safe to call on every cold start.
await outbox.destinations.create({
  destinationId: "sqs-gemini",
  displayName: "SQS Gemini agent",
  target: {
    case: "sqs",
    value: {
      queueUrl: process.env.SQS_QUEUE_URL!,
      region: process.env.AWS_REGION ?? "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  },
  eventTypes: [DestinationEventType.MESSAGE],
});

// Step 3: the Lambda handler — AWS invokes this for every batch of SQS records.
export const handler = async (event: {
  Records: Array<{ body: string }>;
}): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      // Step 4: parse the raw SQS body into a typed Outbox event.
      const payload = JSON.parse(record.body) as Record<string, unknown>;
      const outboxEvent = parse(payload);
      if (outboxEvent.type !== "message") {
        return;
      }

      const { connectorId, message } = outboxEvent;
      const accountId = message.account!.id;

      // Step 5: acknowledge the message so the sender sees a read receipt.
      await outbox.messages.markRead({
        connectorId,
        accountId,
        messages: [message.id],
      });

      // Step 6: fetch conversation history and map it to the provider's format.
      const { items } = await outbox.messages.history({
        connectorId,
        accountId,
        pageSize: 20,
      });
      const contents = items.map((m) => ({
        role: m.direction === MessageDirection.INBOUND ? "user" : "model",
        parts: [{ text: textContent(m.parts[0]) }],
      }));

      // Step 7: call the AI model inside withTyping so the user sees a
      // typing indicator while the model generates the response.
      const reply = await outbox.messages.withTyping(
        { connectorId, accountId },
        async () => {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents,
          });
          return response.text;
        }
      );

      // Step 8: send the reply back through Outbox.
      await outbox.messages.send({
        connectorId,
        recipientId: accountId,
        parts: [textPart(reply ?? "")],
      });
    })
  );
};
