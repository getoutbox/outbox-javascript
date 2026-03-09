// --- SDK-owned enums ---

export const AccountSource = { UNSPECIFIED: 0, API: 1, AUTO: 2 } as const;
export type AccountSource = (typeof AccountSource)[keyof typeof AccountSource];

export const ConnectorState = {
  UNSPECIFIED: 0,
  ACTIVE: 1,
  INACTIVE: 2,
  AUTHORIZING: 3,
  ERROR: 4,
} as const;
export type ConnectorState =
  (typeof ConnectorState)[keyof typeof ConnectorState];

export const DestinationEventType = {
  UNSPECIFIED: 0,
  MESSAGE: 1,
  DELIVERY_UPDATE: 2,
  READ_RECEIPT: 3,
  TYPING_INDICATOR: 4,
} as const;
export type DestinationEventType =
  (typeof DestinationEventType)[keyof typeof DestinationEventType];

export const DestinationPayloadFormat = {
  UNSPECIFIED: 0,
  JSON: 1,
  PROTO_BINARY: 2,
} as const;
export type DestinationPayloadFormat =
  (typeof DestinationPayloadFormat)[keyof typeof DestinationPayloadFormat];

export const DestinationState = {
  UNSPECIFIED: 0,
  ACTIVE: 1,
  PAUSED: 2,
  DEGRADED: 3,
} as const;
export type DestinationState =
  (typeof DestinationState)[keyof typeof DestinationState];

export const MessageDeletionScope = {
  UNSPECIFIED: 0,
  FOR_SENDER: 1,
  FOR_EVERYONE: 2,
} as const;
export type MessageDeletionScope =
  (typeof MessageDeletionScope)[keyof typeof MessageDeletionScope];

export const MessageDirection = {
  UNSPECIFIED: 0,
  INBOUND: 1,
  OUTBOUND: 2,
} as const;
export type MessageDirection =
  (typeof MessageDirection)[keyof typeof MessageDirection];

export const MessageDeliveryStatus = {
  UNSPECIFIED: 0,
  PENDING: 1,
  DELIVERED: 2,
  DISPLAYED: 3,
  PROCESSED: 4,
  FAILED: 5,
  EXPIRED: 6,
} as const;
export type MessageDeliveryStatus =
  (typeof MessageDeliveryStatus)[keyof typeof MessageDeliveryStatus];

export const MessagePartDisposition = {
  UNSPECIFIED: 0,
  RENDER: 1,
  REACTION: 2,
  ATTACHMENT: 3,
  INLINE: 4,
} as const;
export type MessagePartDisposition =
  (typeof MessagePartDisposition)[keyof typeof MessagePartDisposition];

// --- Resource types ---

import type { Connector as ProtoConnector } from "./gen/outbox/v1/connector_pb.js";

// SDK-owned type alias for ConnectorChannelConfig (proto oneof, 47 variants).
export type ConnectorChannelConfig = ProtoConnector["channelConfig"];

// --- SDK-owned destination target interfaces ---

export interface WebhookTarget {
  headers?: Record<string, string>;
  signingSecret?: string;
  url?: string;
}

export interface RestateTarget {
  headers?: Record<string, string>;
  url?: string;
}

export interface InngestTarget {
  eventKey?: string;
  eventName?: string;
  url?: string;
}

export interface CloudflareWorkerTarget {
  cfAccessClientId?: string;
  cfAccessClientSecret?: string;
  headers?: Record<string, string>;
  url?: string;
}

export interface LambdaTarget {
  headers?: Record<string, string>;
  url?: string;
}

export interface TemporalTarget {
  address?: string;
  apiKey?: string;
  namespace?: string;
  taskQueue?: string;
  tlsCertPem?: string;
  tlsKeyPem?: string;
  workflowType?: string;
}

export interface GolemTarget {
  apiToken?: string;
  componentId?: string;
  functionName?: string;
  url?: string;
  workerName?: string;
}

export interface HatchetTarget {
  address?: string;
  apiToken?: string;
  workflowName?: string;
}

export interface SqsTarget {
  accessKeyId?: string;
  messageGroupId?: string;
  queueUrl?: string;
  region?: string;
  secretAccessKey?: string;
}

export interface SnsTarget {
  accessKeyId?: string;
  region?: string;
  secretAccessKey?: string;
  topicArn?: string;
}

export interface EventBridgeTarget {
  accessKeyId?: string;
  detailType?: string;
  eventBus?: string;
  region?: string;
  secretAccessKey?: string;
  source?: string;
}

export interface KafkaTarget {
  brokers?: string;
  saslMechanism?: string;
  saslPassword?: string;
  saslUsername?: string;
  tlsEnabled?: boolean;
  topic?: string;
}

export interface GooglePubSubTarget {
  credentialsJson?: string;
  projectId?: string;
  topicId?: string;
}

export interface NatsTarget {
  credentials?: string;
  password?: string;
  subject?: string;
  token?: string;
  url?: string;
  username?: string;
}

export interface SmtpTarget {
  fromAddress?: string;
  host?: string;
  password?: string;
  port?: number;
  requireTls?: boolean;
  subjectTemplate?: string;
  toAddress?: string;
  username?: string;
}

export interface RabbitMqTarget {
  exchange?: string;
  routingKey?: string;
  url?: string;
}

export interface AzureServiceBusTarget {
  connectionString?: string;
  queueOrTopic?: string;
}

export interface RedisTarget {
  streamKey?: string;
  url?: string;
}

export type DestinationTarget =
  | { case: "cloudflareWorker"; value: CloudflareWorkerTarget }
  | { case: "eventBridge"; value: EventBridgeTarget }
  | { case: "golem"; value: GolemTarget }
  | { case: "googlePubSub"; value: GooglePubSubTarget }
  | { case: "hatchet"; value: HatchetTarget }
  | { case: "inngest"; value: InngestTarget }
  | { case: "kafka"; value: KafkaTarget }
  | { case: "lambda"; value: LambdaTarget }
  | { case: "nats"; value: NatsTarget }
  | { case: "rabbitMq"; value: RabbitMqTarget }
  | { case: "azureServiceBus"; value: AzureServiceBusTarget }
  | { case: "redis"; value: RedisTarget }
  | { case: "restate"; value: RestateTarget }
  | { case: "smtp"; value: SmtpTarget }
  | { case: "sns"; value: SnsTarget }
  | { case: "sqs"; value: SqsTarget }
  | { case: "temporal"; value: TemporalTarget }
  | { case: "webhook"; value: WebhookTarget }
  | { case: undefined; value: undefined };

export interface ChannelCapabilities {
  deletions: boolean;
  edits: boolean;
  groups: boolean;
  reactions: boolean;
  readReceipts: boolean;
  supportedContentTypes: string[];
  typingIndicators: boolean;
}

export interface Channel {
  capabilities?: ChannelCapabilities;
  createTime?: Date;
  id: string;
}

export interface Account {
  // Empty for auto-created accounts (source=SOURCE_AUTO) until claimed via ClaimAccount.
  contactId?: string;
  createTime?: Date;
  externalId: string;
  id: string;
  metadata: Record<string, string>;
  source: AccountSource;
  updateTime?: Date;
}

export interface Connector {
  // account is populated by the backend after creation or OAuth completion.
  // Present when state is ACTIVE or INACTIVE.
  account?: Account;
  channelConfig: ConnectorChannelConfig;
  createTime?: Date;
  // Human-readable error detail when state is ERROR.
  errorMessage?: string;
  id: string;
  state: ConnectorState;
  tags: string[];
  updateTime?: Date;
}

export type MessagePart =
  | {
      content: Uint8Array;
      contentType: string;
      disposition?: MessagePartDisposition;
      filename?: string;
    }
  | {
      contentType: string;
      disposition?: MessagePartDisposition;
      filename?: string;
      url: string;
    };

export interface Message {
  account?: Account;
  createTime?: Date;
  deleteTime?: Date;
  // Only set on delete/edit responses; absent on normal messages.
  deletionScope?: MessageDeletionScope;
  deliverTime?: Date;
  direction: MessageDirection;
  editNumber: number;
  groupId?: string;
  id: string;
  metadata: Record<string, string>;
  parts: MessagePart[];
  recipientId: string;
  replacedMessageId?: string;
  replyToMessageId?: string;
}

export interface MessageDelivery {
  account?: Account;
  // Only set when delivery failed (proto EXPLICIT presence).
  errorCode?: string;
  errorMessage?: string;
  messageId: string;
  status: MessageDeliveryStatus;
  statusChangeTime?: Date;
}

export interface ReadReceiptEvent {
  account?: Account;
  messageIds: string[];
  timestamp?: Date;
}

export interface TypingIndicatorEvent {
  account?: Account;
  contentType?: string;
  timestamp?: Date;
  typing: boolean;
}

export interface Destination {
  createTime?: Date;
  displayName?: string;
  eventTypes: DestinationEventType[];
  filter?: string;
  id: string;
  lastTestSuccess?: boolean;
  lastTestTime?: Date;
  payloadFormat: DestinationPayloadFormat;
  state: DestinationState;
  target: DestinationTarget;
  updateTime?: Date;
}

// --- Delivery event discriminated union ---

/**
 * A parsed delivery event received from Outbox.
 * Check `event.type` to narrow to the specific variant:
 *
 * - `"message"` → `event.message: Message`
 * - `"deliveryUpdate"` → `event.deliveryUpdate: MessageDelivery`
 * - `"readReceipt"` → `event.readReceipt: ReadReceiptEvent`
 * - `"typingIndicator"` → `event.typingIndicator: TypingIndicatorEvent`
 * - `"unknown"` → unrecognised event type
 */
interface DeliveryEventBase {
  connectorId: string;
  deliveryId: string;
  destinationId: string;
  enqueueTime?: Date;
}

export type DeliveryEvent =
  | (DeliveryEventBase & { type: "message"; message: Message })
  | (DeliveryEventBase & {
      type: "deliveryUpdate";
      deliveryUpdate: MessageDelivery;
    })
  | (DeliveryEventBase & { type: "readReceipt"; readReceipt: ReadReceiptEvent })
  | (DeliveryEventBase & {
      type: "typingIndicator";
      typingIndicator: TypingIndicatorEvent;
    })
  | (DeliveryEventBase & { type: "unknown" });

// --- DeliveryEvent type guards ---

export function isMessage(
  event: DeliveryEvent
): event is DeliveryEventBase & { type: "message"; message: Message } {
  return event.type === "message";
}

export function isDeliveryUpdate(
  event: DeliveryEvent
): event is DeliveryEventBase & {
  type: "deliveryUpdate";
  deliveryUpdate: MessageDelivery;
} {
  return event.type === "deliveryUpdate";
}

export function isReadReceipt(
  event: DeliveryEvent
): event is DeliveryEventBase & {
  type: "readReceipt";
  readReceipt: ReadReceiptEvent;
} {
  return event.type === "readReceipt";
}

export function isTypingIndicator(
  event: DeliveryEvent
): event is DeliveryEventBase & {
  type: "typingIndicator";
  typingIndicator: TypingIndicatorEvent;
} {
  return event.type === "typingIndicator";
}
