import Anthropic from "@anthropic-ai/sdk";
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

// Run once to register (or update) the Lambda destination.
// Upsert semantics mean it is safe to call on every cold start.
export async function registerDestination(): Promise<void> {
  await outbox.destinations.create({
    destinationId: "lambda-anthropic",
    displayName: "Lambda Anthropic agent",
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
