import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  DestinationEventType,
  MessageDirection,
  OutboxClient,
  parse,
  textContent,
  textPart,
} from "@outbox-sdk/outbox";

const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
const llm = new ChatOpenAI({ model: "gpt-5.2" });

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
  const msgs = items.map((m) =>
    m.direction === MessageDirection.INBOUND
      ? new HumanMessage(textContent(m.parts[0]))
      : new AIMessage(textContent(m.parts[0]))
  );

  const reply = await outbox.messages.withTyping(
    { connectorId, accountId },
    async () => {
      const response = await llm.invoke(msgs);
      return response.content as string;
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}

async function main(): Promise<void> {
  const hatchet = Hatchet.init();

  await outbox.destinations.create({
    destinationId: "hatchet-langchain",
    displayName: "Hatchet LangChain agent",
    target: {
      case: "hatchet",
      value: {
        address: "grpc.hatchet.run:443",
        workflowName: "handle-message",
        apiToken: process.env.HATCHET_API_TOKEN!,
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });

  const handleMessage = hatchet.task({
    name: "handle-message",
    fn: async (input: Record<string, unknown>) => {
      await processMessage(input);
    },
  });

  const worker = await hatchet.worker("outbox-worker", {
    workflows: [handleMessage],
  });
  await worker.start();
}

main().catch(console.error);
