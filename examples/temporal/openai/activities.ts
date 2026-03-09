import {
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import OpenAI from "openai";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function processMessage(
  payload: Record<string, unknown>
): Promise<void> {
  const event = parse(payload);
  if (event.type !== "message") {
    return;
  }

  const { connectorId, message } = event;
  const accountId = message.account!.id;

  // Acknowledge the message as read.
  await outbox.messages.markRead({
    connectorId,
    accountId,
    messages: [message.id],
  });

  // Fetch conversation history (includes the message that just arrived).
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

  // Show a typing indicator while the LLM thinks, then send the reply.
  const reply = await outbox.messages.withTyping(
    { connectorId, accountId },
    async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: chatMessages,
      });
      return response.choices[0].message.content ?? "";
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}
