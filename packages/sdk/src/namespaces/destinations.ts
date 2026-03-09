import type { Client } from "@connectrpc/connect";
import type {
  DestinationService,
  PollEventsResponse,
} from "../gen/outbox/v1/destination_pb.js";
import { deriveFieldMask } from "../internal/field-mask.js";
import { mapDeliveryEvent, mapDestination } from "../internal/mappers.js";
import { destinationName } from "../internal/resource-names.js";
import type {
  DeliveryEvent,
  Destination,
  DestinationEventType,
  DestinationPayloadFormat,
  DestinationTarget,
} from "../types.js";

function targetPaths(target: DestinationTarget): string[] {
  if (target.case === undefined) {
    return [];
  }
  // Field mask path for a oneof field is the specific field name in snake_case.
  return [target.case.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
}

export interface ListDestinationsResult {
  items: Destination[];
  nextPageToken?: string;
  totalSize: number;
}

export interface CreateDestinationInput {
  destinationId?: string;
  displayName?: string;
  eventTypes?: DestinationEventType[];
  filter?: string;
  payloadFormat?: DestinationPayloadFormat;
  requestId?: string;
  target: DestinationTarget;
}

export interface UpdateDestinationInput {
  displayName?: string;
  eventTypes?: DestinationEventType[];
  filter?: string;
  id: string;
  payloadFormat?: DestinationPayloadFormat;
  target?: DestinationTarget;
}

export interface ListDestinationsInput {
  filter?: string;
  orderBy?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface TestDestinationResult {
  errorMessage?: string;
  httpStatusCode: number;
  latencyMs: bigint;
  success: boolean;
}

export interface DestinationTestResultItem {
  errorMessage?: string;
  httpStatusCode: number;
  latencyMs: bigint;
  success: boolean;
  testTime?: Date;
}

export interface ListTestResultsResult {
  items: DestinationTestResultItem[];
}

export interface ValidateFilterResult {
  errorMessage?: string;
  matchedCount: number;
  totalCount: number;
  valid: boolean;
}

export interface ListenOptions {
  maxEvents?: number;
  resumeCursor?: string;
  waitSeconds?: number;
}

function assertDestination<T>(value: T | undefined, operation: string): T {
  if (!value) {
    throw new Error(`${operation}: server returned an empty destination`);
  }
  return value;
}

export class DestinationsNamespace {
  readonly #client: Client<typeof DestinationService>;

  constructor(client: Client<typeof DestinationService>) {
    this.#client = client;
  }

  async create(input: CreateDestinationInput): Promise<Destination> {
    const { requestId, destinationId, ...fields } = input;
    const res = await this.#client.createDestination({
      destination: fields,
      requestId,
      destinationId,
    });
    return mapDestination(
      assertDestination(res.destination, "createDestination")
    );
  }

  async get(id: string): Promise<Destination> {
    const res = await this.#client.getDestination({
      name: destinationName(id),
    });
    return mapDestination(assertDestination(res.destination, "getDestination"));
  }

  async list(
    input: ListDestinationsInput = {}
  ): Promise<ListDestinationsResult> {
    const res = await this.#client.listDestinations(input);
    return {
      items: res.destinations.map(mapDestination),
      nextPageToken: res.nextPageToken || undefined,
      totalSize: Number(res.totalSize),
    };
  }

  async update(input: UpdateDestinationInput): Promise<Destination> {
    const { id, target, ...scalarFields } = input;
    const paths: string[] = [
      ...deriveFieldMask(scalarFields).paths,
      ...(target !== undefined ? targetPaths(target) : []),
    ];
    const res = await this.#client.updateDestination({
      destination: {
        name: destinationName(id),
        ...scalarFields,
        target,
      },
      updateMask: { paths },
    });
    return mapDestination(
      assertDestination(res.destination, "updateDestination")
    );
  }

  async delete(id: string): Promise<void> {
    await this.#client.deleteDestination({ name: destinationName(id) });
  }

  async test(id: string): Promise<TestDestinationResult> {
    const res = await this.#client.testDestination({
      name: destinationName(id),
    });
    return {
      success: res.success,
      errorMessage: res.errorMessage || undefined,
      httpStatusCode: res.httpStatusCode,
      latencyMs: res.latencyMs,
    };
  }

  async listTestResults(
    id: string,
    options: { pageSize?: number } = {}
  ): Promise<ListTestResultsResult> {
    const res = await this.#client.listDestinationTestResults({
      name: destinationName(id),
      pageSize: options.pageSize,
    });
    return {
      items: res.results.map((r) => ({
        success: r.success,
        errorMessage: r.errorMessage || undefined,
        httpStatusCode: r.httpStatusCode,
        latencyMs: r.latencyMs,
        testTime: r.testTime
          ? new Date(
              Number(r.testTime.seconds) * 1000 +
                Math.round(r.testTime.nanos / 1_000_000)
            )
          : undefined,
      })),
    };
  }

  async validateFilter(
    filter: string,
    options: { sampleSize?: number } = {}
  ): Promise<ValidateFilterResult> {
    const res = await this.#client.validateDestinationFilter({
      filter,
      sampleSize: options.sampleSize,
    });
    return {
      valid: res.valid,
      errorMessage: res.errorMessage || undefined,
      matchedCount: res.matchedCount,
      totalCount: res.totalCount,
    };
  }

  async *listen(
    id: string,
    options: ListenOptions = {},
    signal?: AbortSignal
  ): AsyncGenerator<DeliveryEvent> {
    let cursor = options.resumeCursor ?? "";
    const name = destinationName(id);

    while (!signal?.aborted) {
      const req: {
        name: string;
        cursor: string;
        maxEvents?: number;
        waitSeconds?: number;
      } = {
        name,
        cursor,
      };
      if (options.maxEvents !== undefined) {
        req.maxEvents = options.maxEvents;
      }
      if (options.waitSeconds !== undefined) {
        req.waitSeconds = options.waitSeconds;
      }

      let res: PollEventsResponse;
      try {
        res = await this.#client.pollEvents(req);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        throw err;
      }

      cursor = res.cursor;
      for (const event of res.events) {
        if (signal?.aborted) {
          return;
        }
        yield mapDeliveryEvent(event);
      }
    }
  }
}
