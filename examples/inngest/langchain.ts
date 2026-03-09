import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import express from "express";
import { Inngest } from "inngest";
import { serve } from "inngest/express";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const llm = new ChatOpenAI({ model: "gpt-5.2" });
const inngest = new Inngest({ id: "langchain-agent" });

export const handleOutboxMessage = inngest.createFunction(
  { id: "handle-outbox-message" },
  { event: "outbox/message.received" },
  async ({ event }) => {
    const deliveryEvent = parse(event.data);
    if (deliveryEvent.type !== "message") {
      return;
    }

    const { connectorId, message: outboxMessage } = deliveryEvent;
    const accountId = outboxMessage.account!.id;

    await outbox.messages.markRead({
      connectorId,
      accountId,
      messages: [outboxMessage.id],
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

    const replyText = await outbox.messages.withTyping(
      { connectorId, accountId },
      async () => {
        const response = await llm.invoke(msgs);
        return response.content as string;
      }
    );

    await outbox.messages.send({
      connectorId,
      recipientId: accountId,
      parts: [textPart(replyText)],
    });
  }
);

const app = express();
app.use(express.json());
app.use(
  "/api/inngest",
  serve({ client: inngest, functions: [handleOutboxMessage] })
);
app.listen(process.env.PORT ?? 3000);
