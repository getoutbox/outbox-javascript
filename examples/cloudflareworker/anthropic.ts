/// <reference types="@cloudflare/workers-types" />

import Anthropic from "@anthropic-ai/sdk";
import {
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";

interface Env {
  ANTHROPIC_API_KEY: string;
  OUTBOX_API_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    ctx.waitUntil(processEvent(payload, env));
    return new Response("ok");
  },
};

async function processEvent(
  payload: Record<string, unknown>,
  env: Env
): Promise<void> {
  const outbox = new OutboxClient({ apiKey: env.OUTBOX_API_KEY });
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: chatMessages,
      });
      return response.content[0].type === "text"
        ? response.content[0].text
        : "";
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}
