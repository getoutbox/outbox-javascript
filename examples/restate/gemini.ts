import { GoogleGenAI } from "@google/genai";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";
import * as restate from "@restatedev/restate-sdk";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

await outbox.destinations.create({
  destinationId: "restate-gemini",
  displayName: "Restate Gemini agent",
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
    },
  },
});

restate.serve({ services: [messageService], port: 9080 });
