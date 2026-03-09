import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { AccountService } from "./gen/outbox/v1/account_pb.js";
import { ChannelService } from "./gen/outbox/v1/channel_pb.js";
import { ConnectorService } from "./gen/outbox/v1/connector_pb.js";
import { DestinationService } from "./gen/outbox/v1/destination_pb.js";
import { MessageService } from "./gen/outbox/v1/message_pb.js";

import { AccountsNamespace } from "./namespaces/accounts.js";
import { ChannelsNamespace } from "./namespaces/channels.js";
import { ConnectorsNamespace } from "./namespaces/connectors.js";
import { DestinationsNamespace } from "./namespaces/destinations.js";
import { MessagesNamespace } from "./namespaces/messages.js";

// Helpers
export {
  parse,
  textContent,
  textPart,
  verify,
} from "./helpers.js";
// Resource name utilities
export { parseId } from "./internal/resource-names.js";
export type {
  ClaimAccountInput,
  CreateAccountInput,
  ListAccountsInput,
  ListAccountsResult,
  UpdateAccountInput,
} from "./namespaces/accounts.js";
export type {
  ListChannelsInput,
  ListChannelsResult,
} from "./namespaces/channels.js";
// Namespace input/output types
export type {
  CreateConnectorInput,
  CreateConnectorResult,
  ListConnectorsInput,
  ListConnectorsResult,
  ReauthorizeConnectorResult,
  UpdateConnectorInput,
} from "./namespaces/connectors.js";
export type {
  CreateDestinationInput,
  DestinationTestResultItem,
  ListDestinationsInput,
  ListDestinationsResult,
  ListenOptions,
  ListTestResultsResult,
  TestDestinationResult,
  UpdateDestinationInput,
  ValidateFilterResult,
} from "./namespaces/destinations.js";
export type {
  DeleteMessageInput,
  HistoryInput,
  ListMessagesInput,
  ListMessagesResult,
  MarkReadInput,
  SendMessageInput,
  SendMessageResult,
  TypingInput,
  UpdateMessageInput,
  WithTypingInput,
} from "./namespaces/messages.js";
// Resource and event types
export type {
  Account,
  AzureServiceBusTarget,
  Channel,
  ChannelCapabilities,
  CloudflareWorkerTarget,
  Connector,
  ConnectorChannelConfig,
  DeliveryEvent,
  Destination,
  DestinationTarget,
  EventBridgeTarget,
  GolemTarget,
  GooglePubSubTarget,
  HatchetTarget,
  InngestTarget,
  KafkaTarget,
  LambdaTarget,
  Message,
  MessageDelivery,
  MessagePart,
  NatsTarget,
  RabbitMqTarget,
  ReadReceiptEvent,
  RedisTarget,
  RestateTarget,
  SmtpTarget,
  SnsTarget,
  SqsTarget,
  TemporalTarget,
  TypingIndicatorEvent,
  WebhookTarget,
} from "./types.js";
export {
  AccountSource,
  ConnectorState,
  DestinationEventType,
  DestinationPayloadFormat,
  DestinationState,
  isDeliveryUpdate,
  isMessage,
  isReadReceipt,
  isTypingIndicator,
  MessageDeletionScope,
  MessageDeliveryStatus,
  MessageDirection,
  MessagePartDisposition,
} from "./types.js";

export interface OutboxClientOptions {
  /** Outbox API key (starts with ob_live_ or ob_test_). */
  apiKey: string;
  /** Base URL of the outbox-api service. Defaults to https://api.outbox.chat. */
  baseUrl?: string;
}

export class OutboxClient {
  readonly accounts: AccountsNamespace;
  readonly channels: ChannelsNamespace;
  readonly connectors: ConnectorsNamespace;
  readonly destinations: DestinationsNamespace;
  readonly messages: MessagesNamespace;

  constructor(options: OutboxClientOptions) {
    const { apiKey, baseUrl = "https://api.outbox.chat" } = options;

    const transport = createConnectTransport({
      baseUrl,
      interceptors: [
        (next) => (req) => {
          req.header.set("Authorization", `Bearer ${apiKey}`);
          return next(req);
        },
      ],
    });

    this.accounts = new AccountsNamespace(
      createClient(AccountService, transport)
    );
    this.channels = new ChannelsNamespace(
      createClient(ChannelService, transport)
    );
    this.connectors = new ConnectorsNamespace(
      createClient(ConnectorService, transport)
    );
    this.destinations = new DestinationsNamespace(
      createClient(DestinationService, transport)
    );
    this.messages = new MessagesNamespace(
      createClient(MessageService, transport)
    );
  }
}

export default OutboxClient;
