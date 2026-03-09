import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
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
const llm = new ChatOpenAI({ model: "gpt-5.2" });

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
      const msgs = items.map((m) =>
        m.direction === MessageDirection.INBOUND
          ? new HumanMessage(textContent(m.parts[0]))
          : new AIMessage(textContent(m.parts[0]))
      );

      const reply = await outbox.messages.withTyping(
        { connectorId, accountId },
        async () => {
          const res = await llm.invoke(msgs);
          return res.content as string;
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
