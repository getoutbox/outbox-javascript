import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { Account as ProtoAccount } from "../gen/outbox/v1/account_pb.js";
import type { Connector as ProtoConnector } from "../gen/outbox/v1/connector_pb.js";
import type {
  DeliveryEvent as ProtoDeliveryEvent,
  Destination as ProtoDestination,
} from "../gen/outbox/v1/destination_pb.js";
import type {
  Message as ProtoMessage,
  MessageDelivery as ProtoMessageDelivery,
  MessagePart as ProtoMessagePart,
  ReadReceiptEvent as ProtoReadReceiptEvent,
  TypingIndicatorEvent as ProtoTypingIndicatorEvent,
} from "../gen/outbox/v1/message_pb.js";
import type { Template as ProtoTemplate } from "../gen/outbox/v1/template_pb.js";
import type {
  Account,
  AccountSource,
  Connector,
  ConnectorKind,
  ConnectorReadiness,
  ConnectorState,
  DeliveryEvent,
  Destination,
  DestinationEventType,
  DestinationPayloadFormat,
  DestinationState,
  DestinationTarget,
  Message,
  MessageDeletionScope,
  MessageDelivery,
  MessageDeliveryStatus,
  MessageDirection,
  MessagePart,
  MessagePartDisposition,
  ReadReceiptEvent,
  Template,
  TemplateCategory,
  TemplateStatus,
  TypingIndicatorEvent,
} from "../types.js";
import { parseId } from "./resource-names.js";

function protoTimestamp(ts: Timestamp | undefined): Date | undefined {
  if (!ts) {
    return undefined;
  }
  return new Date(Number(ts.seconds) * 1000 + Math.round(ts.nanos / 1_000_000));
}

export function mapConnector(p: ProtoConnector): Connector {
  return {
    id: parseId(p.name),
    kind: p.kind as ConnectorKind,
    state: p.state as ConnectorState,
    readiness: p.readiness as ConnectorReadiness,
    provisionedResources: p.provisionedResources.map(parseId),
    webhookUrl: p.webhookUrl,
    displayName: p.displayName,
    channelConfig: p.channelConfig,
    tags: [...p.tags],
    errorMessage: p.errorMessage || undefined,
    createTime: protoTimestamp(p.createTime),
    updateTime: protoTimestamp(p.updateTime),
  };
}

export function mapTemplate(p: ProtoTemplate): Template {
  // name format: "connectors/{connectorId}/templates/{id}"
  const parts = p.name.split("/");
  if (parts.length < 4 || !parts[1] || !parts[3]) {
    throw new Error(`Invalid template resource name: "${p.name}"`);
  }
  const connectorId = parts[1];
  const id = parts[3];
  return {
    id,
    connectorId,
    templateName: p.templateName,
    language: p.language,
    category: p.category as TemplateCategory,
    componentsJson: p.componentsJson,
    status: p.status as TemplateStatus,
    rejectionReason: p.rejectionReason || undefined,
    externalId: p.externalId || undefined,
    createTime: protoTimestamp(p.createTime),
    updateTime: protoTimestamp(p.updateTime),
  };
}

export function mapAccount(p: ProtoAccount): Account {
  return {
    id: parseId(p.name),
    contactId: p.contactId || undefined,
    externalId: p.externalId,
    metadata: { ...p.metadata },
    source: p.source as AccountSource,
    createTime: protoTimestamp(p.createTime),
    updateTime: protoTimestamp(p.updateTime),
  };
}

function mapMessagePart(p: ProtoMessagePart): MessagePart {
  const base = {
    contentType: p.contentType,
    disposition: (p.disposition as MessagePartDisposition) || undefined,
    filename: p.filename || undefined,
  };
  if (p.source.case === "url") {
    return { ...base, url: p.source.value };
  }
  return {
    ...base,
    content: p.source.case === "content" ? p.source.value : new Uint8Array(),
  };
}

export function mapMessage(p: ProtoMessage): Message {
  return {
    id: parseId(p.name),
    account: p.account ? mapAccount(p.account) : undefined,
    recipientId: parseId(p.recipient),
    parts: p.parts.map(mapMessagePart),
    metadata: { ...p.metadata },
    direction: p.direction as MessageDirection,
    createTime: protoTimestamp(p.createTime),
    deliverTime: protoTimestamp(p.deliverTime),
    replyToMessageId: p.replyTo ? parseId(p.replyTo) : undefined,
    groupId: p.groupId || undefined,
    replacedMessageId: p.replaced ? parseId(p.replaced) : undefined,
    deletionScope: (p.scope as MessageDeletionScope) || undefined,
    editNumber: Number(p.editNumber),
    deleteTime: protoTimestamp(p.deleteTime),
  };
}

export function mapMessageDelivery(p: ProtoMessageDelivery): MessageDelivery {
  return {
    messageId: parseId(p.message),
    account: p.account ? mapAccount(p.account) : undefined,
    status: p.status as MessageDeliveryStatus,
    errorCode: p.errorCode || undefined,
    errorMessage: p.errorMessage || undefined,
    statusChangeTime: protoTimestamp(p.statusChangeTime),
  };
}

export function mapReadReceipt(p: ProtoReadReceiptEvent): ReadReceiptEvent {
  return {
    account: p.account ? mapAccount(p.account) : undefined,
    messageIds: p.messages.map(parseId),
    timestamp: protoTimestamp(p.timestamp),
  };
}

export function mapTypingIndicator(
  p: ProtoTypingIndicatorEvent
): TypingIndicatorEvent {
  return {
    account: p.account ? mapAccount(p.account) : undefined,
    typing: p.typing,
    timestamp: protoTimestamp(p.timestamp),
    contentType: p.contentType || undefined,
  };
}

export function mapDeliveryEvent(p: ProtoDeliveryEvent): DeliveryEvent {
  // connector is always set by the server; empty string indicates a malformed event
  const connectorId = p.connector ? parseId(p.connector) : "";
  const destinationId = p.destination ? parseId(p.destination) : "";
  const deliveryId = p.deliveryId;
  const enqueueTime = protoTimestamp(p.enqueueTime);
  const base = { connectorId, deliveryId, destinationId, enqueueTime };
  const { event } = p;
  switch (event.case) {
    case "message":
      return { ...base, type: "message", message: mapMessage(event.value) };
    case "deliveryUpdate":
      return {
        ...base,
        type: "deliveryUpdate",
        deliveryUpdate: mapMessageDelivery(event.value),
      };
    case "readReceipt":
      return {
        ...base,
        type: "readReceipt",
        readReceipt: mapReadReceipt(event.value),
      };
    case "typingIndicator":
      return {
        ...base,
        type: "typingIndicator",
        typingIndicator: mapTypingIndicator(event.value),
      };
    default:
      return { ...base, type: "unknown" };
  }
}

function mapDestinationTarget(
  t: ProtoDestination["target"]
): DestinationTarget {
  if (t.case === undefined) {
    return { case: undefined, value: undefined };
  }
  return { case: t.case, value: { ...t.value } } as DestinationTarget;
}

export function mapDestination(p: ProtoDestination): Destination {
  return {
    id: parseId(p.name),
    displayName: p.displayName || undefined,
    state: p.state as DestinationState,
    eventTypes: [...p.eventTypes] as DestinationEventType[],
    filter: p.filter || undefined,
    payloadFormat: p.payloadFormat as DestinationPayloadFormat,
    target: mapDestinationTarget(p.target),
    createTime: protoTimestamp(p.createTime),
    updateTime: protoTimestamp(p.updateTime),
    lastTestTime: protoTimestamp(p.lastTestTime) || undefined,
    lastTestSuccess: p.lastTestTime ? p.lastTestSuccess : undefined,
  };
}
