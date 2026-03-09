import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import * as restate from "@restatedev/restate-sdk";
import OpenAI from "openai";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});

await outbox.destinations.create({
  destinationId: "restate-xai",
  displayName: "Restate xAI agent",
  target: {
    case: "restate",
    value: {
      url: "https://restate.example.com/MessageService/handleEvent",
    },
  },
  eventTypes: [DestinationEventType.MESSAGE],
});

export const messageService = restate.service({
  name: "MessageService",
  handlers: {
    handleEvent: async (
      _ctx: restate.Context,
      payload: Record<string, unknown>
    ): Promise<void> => {
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
        role: (m.direction === MessageDirection.INBOUND
          ? "user"
          : "assistant") as "user" | "assistant",
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
    },
  },
});

restate.serve({ services: [messageService], port: 9080 });
