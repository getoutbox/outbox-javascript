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

// Run once to register (or update) the Lambda destination.
// Upsert semantics mean it is safe to call on every cold start.
export async function registerDestination(): Promise<void> {
  await outbox.destinations.create({
    destinationId: "lambda-xai",
    displayName: "Lambda xAI agent",
    target: {
      case: "lambda",
      value: {
        url: process.env.LAMBDA_FUNCTION_URL!,
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });
}

// Lambda entry point — Outbox POSTs the event to the function URL.
export const handler = async (event: {
  body: string;
}): Promise<{ statusCode: number; body: string }> => {
  const payload = JSON.parse(event.body) as Record<string, unknown>;
  await processMessage(payload).catch(console.error);
  return { statusCode: 200, body: "" };
};

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
