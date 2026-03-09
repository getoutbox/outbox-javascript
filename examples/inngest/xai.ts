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
import OpenAI from "openai";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});
const inngest = new Inngest({ id: "xai-agent" });

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
    const chatMessages = items.map((m) => ({
      role: (m.direction === MessageDirection.INBOUND ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: textContent(m.parts[0]),
    }));

    const replyText = await outbox.messages.withTyping(
      { connectorId, accountId },
      async () => {
        const response = await xai.chat.completions.create({
          model: "grok-4",
          messages: chatMessages,
        });
        return response.choices[0].message.content ?? "";
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
