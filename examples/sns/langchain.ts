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

// Run once to register the destination before deploying the Lambda function.
// Upsert semantics mean it is safe to call on every deployment.
export async function register(): Promise<void> {
  await outbox.destinations.create({
    destinationId: "sns-agent",
    displayName: "SNS agent",
    target: {
      case: "sns",
      value: {
        topicArn: process.env.SNS_TOPIC_ARN!,
        region: process.env.AWS_REGION ?? "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });
}

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
      const res = await llm.invoke(msgs);
      return res.content as string;
    }
  );

  await outbox.messages.send({
    connectorId,
    recipientId: accountId,
    parts: [textPart(reply)],
  });
}

export const handler = async (event: {
  Records: Array<{ Sns: { Message: string } }>;
}): Promise<void> => {
  await Promise.all(
    event.Records.map((record) => {
      const payload = JSON.parse(record.Sns.Message) as Record<string, unknown>;
      return processMessage(payload);
    })
  );
};
