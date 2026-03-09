import type { Client } from "@connectrpc/connect";
import type {
  MessageService,
  Message as ProtoMessage,
} from "../gen/outbox/v1/message_pb.js";
import { deriveFieldMask } from "../internal/field-mask.js";
import { mapMessage, mapMessageDelivery } from "../internal/mappers.js";
import {
  accountName,
  connectorName,
  messageName,
} from "../internal/resource-names.js";
import type {
  Message,
  MessageDeletionScope,
  MessageDelivery,
  MessagePart,
} from "../types.js";

export interface HistoryInput {
  accountId: string;
  connectorId: string;
  pageSize?: number;
  pageToken?: string;
}

function assertMessage(
  value: ProtoMessage | undefined,
  operation: string
): ProtoMessage {
  if (!value) {
    throw new Error(`${operation}: server returned empty message`);
  }
  return value;
}

export interface DeleteMessageInput {
  deletionScope: MessageDeletionScope;
  id: string;
  requestId?: string;
}

export interface ListMessagesInput {
  connectorId: string;
  filter?: string;
  orderBy?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface ListMessagesResult {
  items: Message[];
  nextPageToken?: string;
  totalSize: number;
}

export interface MarkReadInput {
  accountId: string;
  connectorId: string;
  messages: string[];
}

export interface SendMessageInput {
  connectorId: string;
  groupId?: string;
  metadata?: Record<string, string>;
  parts: MessagePart[];
  recipientId: string;
  replacedMessageId?: string;
  replyToMessageId?: string;
  requestId?: string;
}

export interface TypingInput {
  accountId: string;
  connectorId: string;
  typing: boolean;
}

export interface SendMessageResult {
  delivery?: MessageDelivery;
  message: Message;
}

export interface UpdateMessageInput {
  id: string;
  parts?: MessagePart[];
  requestId?: string;
}

export interface WithTypingInput {
  accountId: string;
  connectorId: string;
}

function toProtoMessagePart(p: MessagePart) {
  return {
    contentType: p.contentType,
    disposition: p.disposition,
    filename: p.filename,
    source:
      "content" in p
        ? { case: "content" as const, value: p.content }
        : { case: "url" as const, value: p.url },
  };
}

export class MessagesNamespace {
  readonly #client: Client<typeof MessageService>;

  constructor(client: Client<typeof MessageService>) {
    this.#client = client;
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const {
      connectorId,
      recipientId,
      replyToMessageId,
      replacedMessageId,
      requestId,
      parts,
      groupId,
      metadata,
    } = input;
    const res = await this.#client.createMessage({
      message: {
        parts: parts.map(toProtoMessagePart),
        groupId,
        metadata,
        recipient: accountName(recipientId),
        replyTo: replyToMessageId ? messageName(replyToMessageId) : undefined,
        replaced: replacedMessageId
          ? messageName(replacedMessageId)
          : undefined,
      },
      connector: connectorName(connectorId),
      requestId,
    });
    return {
      delivery: res.delivery ? mapMessageDelivery(res.delivery) : undefined,
      message: mapMessage(assertMessage(res.message, "send")),
    };
  }

  async update(input: UpdateMessageInput): Promise<Message> {
    const { id, requestId, parts } = input;
    const res = await this.#client.updateMessage({
      message: {
        name: messageName(id),
        parts: parts?.map(toProtoMessagePart),
      },
      requestId,
      updateMask: deriveFieldMask({ parts }),
    });
    return mapMessage(assertMessage(res.message, "update"));
  }

  async delete(input: DeleteMessageInput): Promise<Message> {
    const { id, requestId, deletionScope } = input;
    const res = await this.#client.deleteMessage({
      name: messageName(id),
      requestId,
      scope: deletionScope,
    });
    return mapMessage(assertMessage(res.message, "delete"));
  }

  async list(input: ListMessagesInput): Promise<ListMessagesResult> {
    const { connectorId, ...rest } = input;
    const res = await this.#client.listMessages({
      parent: connectorName(connectorId),
      ...rest,
    });
    return {
      items: res.messages.map(mapMessage),
      nextPageToken: res.nextPageToken || undefined,
      totalSize: Number(res.totalSize),
    };
  }

  async markRead(input: MarkReadInput): Promise<void> {
    const { connectorId, accountId, messages } = input;
    await this.#client.sendReadReceipt({
      connector: connectorName(connectorId),
      account: accountName(accountId),
      messages: messages.map((id) => messageName(id)),
    });
  }

  async typing(input: TypingInput): Promise<void> {
    const { connectorId, accountId, typing } = input;
    await this.#client.sendTypingIndicator({
      connector: connectorName(connectorId),
      account: accountName(accountId),
      typing,
    });
  }

  async withTyping<T>(
    input: WithTypingInput,
    fn: () => Promise<T>
  ): Promise<T> {
    await this.typing({
      connectorId: input.connectorId,
      accountId: input.accountId,
      typing: true,
    });
    try {
      return await fn();
    } finally {
      await this.typing({
        connectorId: input.connectorId,
        accountId: input.accountId,
        typing: false,
      });
    }
  }

  history(input: HistoryInput): Promise<ListMessagesResult> {
    const { connectorId, accountId, pageSize, pageToken } = input;
    const name = accountName(accountId);
    return this.list({
      connectorId,
      filter: `account.name == "${name}" || recipient == "${name}"`,
      orderBy: "create_time asc",
      pageSize,
      pageToken,
    });
  }
}
