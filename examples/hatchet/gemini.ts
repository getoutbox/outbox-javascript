import { GoogleGenAI } from "@google/genai";
import { Hatchet } from "@hatchet-dev/typescript-sdk";
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
  const contents = items.map((m) => ({
    role: m.direction === MessageDirection.INBOUND ? "user" : "model",
    parts: [{ text: textContent(m.parts[0]) }],
  }));

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

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply ?? "")],
  });
}

async function main(): Promise<void> {
  const hatchet = Hatchet.init();

  await outbox.destinations.create({
    destinationId: "hatchet-gemini",
    displayName: "Hatchet Gemini agent",
    target: {
      case: "hatchet",
      value: {
        address: "grpc.hatchet.run:443",
        workflowName: "handle-message",
        apiToken: process.env.HATCHET_API_TOKEN!,
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });

  const handleMessage = hatchet.task({
    name: "handle-message",
    fn: async (input: Record<string, unknown>) => {
      await processMessage(input);
    },
  });

  const worker = await hatchet.worker("outbox-worker", {
    workflows: [handleMessage],
  });
  await worker.start();
}

main().catch(console.error);
