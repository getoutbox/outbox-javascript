import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const llm = new ChatOpenAI({ model: "gpt-5.2" });

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
  const chatMessages = items.map((m) =>
    m.direction === MessageDirection.INBOUND
      ? new HumanMessage(textContent(m.parts[0]))
      : new AIMessage(textContent(m.parts[0]))
  );

  // Show a typing indicator while the LLM thinks, then send the reply.
  const reply = await outbox.messages.withTyping(
    { connectorId, accountId },
    async () => {
      const response = await llm.invoke(chatMessages);
      return response.content as string;
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}
