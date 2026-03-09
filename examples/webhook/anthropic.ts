import Anthropic from "@anthropic-ai/sdk";
import {
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
  verify,
} from "@outbox-sdk/outbox";
import express from "express";

interface RequestWithRawBody extends express.Request {
  rawBody: BufferSource;
}

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const app = express();
app.use(
  express.json({
    verify: (_req, _res, buf) => {
      (_req as RequestWithRawBody).rawBody = buf as unknown as BufferSource;
    },
  })
);

app.post("/inbound", async (req, res) => {
  const sig = req.headers["x-outbox-signature"] as string;
  if (
    !(await verify({
      body: (req as RequestWithRawBody).rawBody,
      secret: process.env.OUTBOX_SIGNING_SECRET!,
      signature: sig,
    }))
  ) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  Promise.resolve()
    .then(async () => {
      const event = parse(req.body as Record<string, unknown>);
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
    })
    .catch(console.error);
});

app.listen(process.env.PORT ?? 3000, () =>
  console.log(`Listening on :${process.env.PORT ?? 3000}`)
);
