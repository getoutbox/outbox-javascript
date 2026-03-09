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

// Run once to register (or update) the EventBridge destination.
// Upsert semantics mean it is safe to call on every cold start.
export async function registerDestination(): Promise<void> {
  await outbox.destinations.create({
    destinationId: "eventbridge-anthropic",
    displayName: "EventBridge Anthropic agent",
    target: {
      case: "eventBridge",
      value: {
        eventBus: process.env.EVENTBRIDGE_BUS ?? "default",
        region: process.env.AWS_REGION ?? "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });
}

// Lambda entry point — EventBridge puts the Outbox payload in event.detail.
export const handler = async (event: {
  detail: Record<string, unknown>;
}): Promise<void> => {
  await processMessage(event.detail);
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
