import { anyUnpack } from "@bufbuild/protobuf/wkt";
import type { Client } from "@connectrpc/connect";
import type { Operations } from "../gen/google/longrunning/operations_pb.js";
import {
  ConnectorSchema,
  type ConnectorService,
  type Connector as ProtoConnector,
} from "../gen/outbox/v1/connector_pb.js";
import { mapConnector } from "../internal/mappers.js";
import { connectorName } from "../internal/resource-names.js";
import type {
  Connector,
  ConnectorChannelConfig,
  ReauthorizeConnectorResult,
} from "../types.js";

export interface ListConnectorsResult {
  items: Connector[];
  nextPageToken?: string;
  totalSize: number;
}

export interface CreateConnectorInput {
  channelConfig: ConnectorChannelConfig;
  consentAcknowledged?: boolean;
  requestId?: string;
  tags?: string[];
}

export interface CreateConnectorResult {
  // Present when the channel requires OAuth authorization.
  // Redirect the user to this URL to complete setup.
  // Empty string for direct-creation channels.
  authorizationUrl?: string;
  connector: Connector;
}

export interface UpdateConnectorInput {
  channelConfig?: ConnectorChannelConfig;
  id: string;
  tags?: string[];
}

export interface ListConnectorsInput {
  filter?: string;
  orderBy?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface CreateManagedConnectorInput {
  channel: string;
  filters?: Record<string, string>;
  requestId?: string;
  tags?: string[];
  webhookUrl?: string;
}

function assertConnector(
  connector: ProtoConnector | undefined,
  operation: string
): ProtoConnector {
  if (!connector) {
    throw new Error(`${operation}: server returned an empty connector`);
  }
  return connector;
}

function channelConfigPaths(channelConfig: ConnectorChannelConfig): string[] {
  if (channelConfig.case === undefined) {
    return [];
  }
  // Field mask path for a oneof field is the specific field name in snake_case.
  return [channelConfig.case.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
}

export class ConnectorsNamespace {
  readonly #client: Client<typeof ConnectorService>;
  readonly #operations: Client<typeof Operations> | undefined;

  constructor(
    client: Client<typeof ConnectorService>,
    operations?: Client<typeof Operations>
  ) {
    this.#client = client;
    this.#operations = operations;
  }

  async create(input: CreateConnectorInput): Promise<CreateConnectorResult> {
    const { requestId, channelConfig, tags, consentAcknowledged } = input;
    const res = await this.#client.createConnector({
      connector: { channelConfig, tags },
      requestId,
      consentAcknowledged,
    });
    return {
      connector: mapConnector(
        assertConnector(res.connector, "createConnector")
      ),
      authorizationUrl: res.authorizationUrl || undefined,
    };
  }

  async get(id: string): Promise<Connector> {
    const res = await this.#client.getConnector({ name: connectorName(id) });
    return mapConnector(assertConnector(res.connector, "getConnector"));
  }

  async list(input: ListConnectorsInput = {}): Promise<ListConnectorsResult> {
    const res = await this.#client.listConnectors(input);
    return {
      items: res.connectors.map(mapConnector),
      nextPageToken: res.nextPageToken || undefined,
      totalSize: Number(res.totalSize),
    };
  }

  async update(input: UpdateConnectorInput): Promise<Connector> {
    const { id, channelConfig, tags } = input;
    const paths: string[] = [];
    if (tags !== undefined) {
      paths.push("tags");
    }
    if (channelConfig !== undefined) {
      paths.push(...channelConfigPaths(channelConfig));
    }
    const res = await this.#client.updateConnector({
      connector: { name: connectorName(id), channelConfig, tags },
      updateMask: { paths },
    });
    return mapConnector(assertConnector(res.connector, "updateConnector"));
  }

  async delete(id: string): Promise<void> {
    await this.#client.deleteConnector({ name: connectorName(id) });
  }

  async reauthorize(id: string): Promise<ReauthorizeConnectorResult> {
    const res = await this.#client.reauthorizeConnector({
      name: connectorName(id),
    });
    return {
      connector: mapConnector(
        assertConnector(res.connector, "reauthorizeConnector")
      ),
      authorizationUrl: res.authorizationUrl || undefined,
    };
  }

  async activate(id: string): Promise<Connector> {
    const res = await this.#client.activateConnector({
      name: connectorName(id),
    });
    return mapConnector(assertConnector(res.connector, "activateConnector"));
  }

  async deactivate(id: string): Promise<Connector> {
    const res = await this.#client.deactivateConnector({
      name: connectorName(id),
    });
    return mapConnector(assertConnector(res.connector, "deactivateConnector"));
  }

  async verify(
    id: string,
    code: string,
    password?: string
  ): Promise<Connector> {
    const res = await this.#client.verifyConnector({
      name: connectorName(id),
      code,
      password: password ?? "",
    });
    return mapConnector(assertConnector(res.connector, "verifyConnector"));
  }

  async detach(id: string): Promise<Connector> {
    const res = await this.#client.detachProvisionedResource({
      name: connectorName(id),
    });
    return mapConnector(
      assertConnector(res.connector, "detachProvisionedResource")
    );
  }

  async createManaged(input: CreateManagedConnectorInput): Promise<Connector> {
    if (!this.#operations) {
      throw new Error(
        "createManaged requires an operations client — instantiate OutboxClient to use this method"
      );
    }
    let op = await this.#client.createManagedConnector({
      channel: input.channel,
      filters: input.filters ?? {},
      webhookUrl: input.webhookUrl ?? "",
      tags: input.tags ?? [],
      requestId: input.requestId ?? "",
    });

    while (!op.done) {
      await new Promise<void>((r) => setTimeout(r, 2000));
      op = await this.#operations.getOperation({ name: op.name });
    }

    if (op.result.case === "error") {
      const err = op.result.value;
      throw new Error(
        `createManagedConnector failed: ${err.message} (code ${err.code})`
      );
    }

    if (op.result.case !== "response") {
      throw new Error(
        "createManagedConnector: operation completed with no result"
      );
    }

    const connector = anyUnpack(op.result.value, ConnectorSchema);
    if (!connector) {
      throw new Error(
        "createManagedConnector: failed to unpack Connector from operation response"
      );
    }
    return mapConnector(connector);
  }
}
