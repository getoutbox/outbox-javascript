import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryEvent } from "../types.js";
import { DestinationsNamespace } from "./destinations.js";

const protoDestination = {
  name: "destinations/dest1",
  displayName: "My Webhook",
  state: 1,
  eventTypes: [1],
  filter: "",
  payloadFormat: 1,
  target: { case: undefined, value: undefined },
  createTime: undefined,
  updateTime: undefined,
};

const protoDeliveryEvent = {
  connector: "connectors/conn1",
  destination: "destinations/dest1",
  deliveryId: "del-1",
  enqueueTime: undefined,
  event: { case: undefined, value: undefined },
};

function makeClient() {
  return {
    createDestination: vi
      .fn()
      .mockResolvedValue({ destination: protoDestination }),
    getDestination: vi
      .fn()
      .mockResolvedValue({ destination: protoDestination }),
    listDestinations: vi.fn().mockResolvedValue({
      destinations: [protoDestination],
      nextPageToken: "",
      totalSize: BigInt(1),
    }),
    updateDestination: vi
      .fn()
      .mockResolvedValue({ destination: protoDestination }),
    deleteDestination: vi.fn().mockResolvedValue({}),
    testDestination: vi
      .fn()
      .mockResolvedValue({ success: true, errorMessage: "" }),
    listDestinationTestResults: vi.fn().mockResolvedValue({ results: [] }),
    validateDestinationFilter: vi.fn().mockResolvedValue({
      valid: true,
      errorMessage: "",
      matchedCount: 5,
      totalCount: 10,
    }),
    pollEvents: vi
      .fn()
      .mockResolvedValue({ events: [protoDeliveryEvent], cursor: "cur-1" }),
  };
}

describe("DestinationsNamespace", () => {
  let client: ReturnType<typeof makeClient>;
  let ns: DestinationsNamespace;

  beforeEach(() => {
    client = makeClient();
    ns = new DestinationsNamespace(client as any);
  });

  it("create sends destination fields and maps result", async () => {
    const target = {
      case: "webhook" as const,
      value: { url: "https://example.com" } as any,
    };
    const result = await ns.create({ target, displayName: "Test" });
    expect(client.createDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: expect.objectContaining({
          target,
          displayName: "Test",
        }),
      })
    );
    expect(result.id).toBe("dest1");
  });

  it("create forwards destinationId and requestId", async () => {
    await ns.create({
      target: { case: undefined, value: undefined } as any,
      destinationId: "my-dest",
      requestId: "req-1",
    });
    expect(client.createDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationId: "my-dest",
        requestId: "req-1",
      })
    );
  });

  it("create forwards eventTypes, filter, and payloadFormat", async () => {
    const target = { case: "webhook" as const, value: {} as any };
    await ns.create({
      target,
      eventTypes: [1, 2],
      filter: "channel_type == 'whatsapp'",
      payloadFormat: 1,
    });
    expect(client.createDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: expect.objectContaining({
          eventTypes: [1, 2],
          filter: "channel_type == 'whatsapp'",
          payloadFormat: 1,
        }),
      })
    );
  });

  it("get sends destinations/<id> as name", async () => {
    await ns.get("dest1");
    expect(client.getDestination).toHaveBeenCalledWith({
      name: "destinations/dest1",
    });
  });

  it("list maps destinations array and totalSize", async () => {
    const result = await ns.list();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("dest1");
    expect(result.totalSize).toBe(1);
  });

  it("list forwards filter, orderBy, pageSize, and pageToken to client", async () => {
    await ns.list({
      filter: "state == 1",
      orderBy: "display_name asc",
      pageSize: 10,
      pageToken: "tok-xyz",
    });
    expect(client.listDestinations).toHaveBeenCalledWith({
      filter: "state == 1",
      orderBy: "display_name asc",
      pageSize: 10,
      pageToken: "tok-xyz",
    });
  });

  it("list returns empty items and zero totalSize when no destinations exist", async () => {
    client.listDestinations.mockResolvedValue({
      destinations: [],
      nextPageToken: "",
      totalSize: BigInt(0),
    });
    const result = await ns.list();
    expect(result.items).toHaveLength(0);
    expect(result.totalSize).toBe(0);
    expect(result.nextPageToken).toBeUndefined();
  });

  it("update sends destination name and derives field mask", async () => {
    await ns.update({ id: "dest1", displayName: "New Name" });
    expect(client.updateDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: expect.objectContaining({
          name: "destinations/dest1",
          displayName: "New Name",
        }),
        updateMask: { paths: ["display_name"] },
      })
    );
  });

  it("update includes target path in field mask when target case is set", async () => {
    await ns.update({
      id: "dest1",
      target: { case: "webhook" as const, value: {} as any },
    });
    const call = client.updateDestination.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("webhook");
  });

  it("update omits target from field mask when target case is undefined", async () => {
    await ns.update({
      id: "dest1",
      target: { case: undefined, value: undefined } as any,
    });
    const call = client.updateDestination.mock.calls[0][0];
    expect(call.updateMask.paths).not.toContain("webhook");
    expect(call.updateMask.paths).not.toContain("target");
  });

  it("update omits target from field mask when target is not provided", async () => {
    await ns.update({ id: "dest1", displayName: "New" });
    const call = client.updateDestination.mock.calls[0][0];
    expect(call.updateMask.paths).not.toContain("target");
    expect(call.updateMask.paths).toContain("display_name");
  });

  it("delete calls deleteDestination with correct resource name", async () => {
    await ns.delete("dest1");
    expect(client.deleteDestination).toHaveBeenCalledWith({
      name: "destinations/dest1",
    });
  });

  it("test returns success: true and undefined errorMessage", async () => {
    const result = await ns.test("dest1");
    expect(client.testDestination).toHaveBeenCalledWith({
      name: "destinations/dest1",
    });
    expect(result.success).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it("test propagates error message on failure", async () => {
    client.testDestination.mockResolvedValue({
      success: false,
      errorMessage: "Connection refused",
    });
    const result = await ns.test("dest1");
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Connection refused");
  });

  it("listTestResults returns items with mapped fields", async () => {
    client.listDestinationTestResults.mockResolvedValue({
      results: [
        {
          success: true,
          errorMessage: "",
          httpStatusCode: 200,
          latencyMs: BigInt(42),
          testTime: { seconds: BigInt(1000), nanos: 0 },
        },
      ],
    });
    const result = await ns.listTestResults("dest1");
    expect(client.listDestinationTestResults).toHaveBeenCalledWith({
      name: "destinations/dest1",
      pageSize: undefined,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].success).toBe(true);
    expect(result.items[0].latencyMs).toBe(BigInt(42));
    expect(result.items[0].httpStatusCode).toBe(200);
    expect(result.items[0].errorMessage).toBeUndefined();
    expect(result.items[0].testTime).toEqual(new Date(1_000_000));
  });

  it("listTestResults passes pageSize option", async () => {
    await ns.listTestResults("dest1", { pageSize: 20 });
    expect(client.listDestinationTestResults).toHaveBeenCalledWith({
      name: "destinations/dest1",
      pageSize: 20,
    });
  });

  it("listTestResults maps testTime to undefined when not set", async () => {
    client.listDestinationTestResults.mockResolvedValue({
      results: [
        {
          success: false,
          errorMessage: "timeout",
          httpStatusCode: 0,
          latencyMs: BigInt(0),
          testTime: undefined,
        },
      ],
    });
    const result = await ns.listTestResults("dest1");
    expect(result.items[0].testTime).toBeUndefined();
    expect(result.items[0].errorMessage).toBe("timeout");
  });

  it("validateFilter returns valid result with counts", async () => {
    const result = await ns.validateFilter("channel_type == 'sms'");
    expect(client.validateDestinationFilter).toHaveBeenCalledWith({
      filter: "channel_type == 'sms'",
      sampleSize: undefined,
    });
    expect(result.valid).toBe(true);
    expect(result.matchedCount).toBe(5);
    expect(result.totalCount).toBe(10);
    expect(result.errorMessage).toBeUndefined();
  });

  it("validateFilter passes sampleSize option", async () => {
    await ns.validateFilter("channel_type == 'sms'", { sampleSize: 100 });
    expect(client.validateDestinationFilter).toHaveBeenCalledWith({
      filter: "channel_type == 'sms'",
      sampleSize: 100,
    });
  });

  it("validateFilter returns errorMessage when filter is invalid", async () => {
    client.validateDestinationFilter.mockResolvedValue({
      valid: false,
      errorMessage: "unexpected token",
      matchedCount: 0,
      totalCount: 0,
    });
    const result = await ns.validateFilter("bad filter !!!");
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe("unexpected token");
  });

  it("throws when server returns no destination on get", async () => {
    client.getDestination.mockResolvedValue({ destination: undefined });
    await expect(ns.get("dest1")).rejects.toThrow("getDestination");
  });

  it("create throws when server returns no destination", async () => {
    client.createDestination.mockResolvedValue({ destination: undefined });
    await expect(
      ns.create({ target: { case: undefined, value: undefined } as any })
    ).rejects.toThrow("createDestination");
  });

  it("update throws when server returns no destination", async () => {
    client.updateDestination.mockResolvedValue({ destination: undefined });
    await expect(
      ns.update({ id: "dest1", displayName: "New" })
    ).rejects.toThrow("updateDestination");
  });

  it("listen yields events from a single poll response", async () => {
    const ac = new AbortController();
    // First poll returns one event; abort after collecting it so the loop terminates.
    client.pollEvents.mockResolvedValueOnce({
      events: [protoDeliveryEvent],
      cursor: "cur-1",
    });

    const events: DeliveryEvent[] = [];
    for await (const event of ns.listen("dest1", {}, ac.signal)) {
      events.push(event);
      ac.abort(); // abort after receiving the first event
    }

    expect(events).toHaveLength(1);
    expect(client.pollEvents).toHaveBeenCalledWith(
      expect.objectContaining({ name: "destinations/dest1", cursor: "" })
    );
  });

  it("listen passes cursor from previous response into next request", async () => {
    const ac = new AbortController();
    client.pollEvents
      .mockResolvedValueOnce({
        events: [protoDeliveryEvent],
        cursor: "cur-abc",
      })
      .mockImplementationOnce(() => {
        ac.abort();
        return Promise.resolve({ events: [], cursor: "cur-abc" });
      });

    const events: DeliveryEvent[] = [];
    for await (const event of ns.listen("dest1", {}, ac.signal)) {
      events.push(event);
    }

    expect(client.pollEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "cur-abc" })
    );
  });

  it("listen uses resumeCursor as the initial cursor", async () => {
    const ac = new AbortController();
    client.pollEvents.mockImplementationOnce(() => {
      ac.abort();
      return Promise.resolve({ events: [], cursor: "start-cursor" });
    });

    for await (const _ of ns.listen(
      "dest1",
      { resumeCursor: "start-cursor" },
      ac.signal
    )) {
      // no events expected
    }

    expect(client.pollEvents).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "start-cursor" })
    );
  });

  it("listen forwards maxEvents and waitSeconds options", async () => {
    const ac = new AbortController();
    client.pollEvents.mockImplementationOnce(() => {
      ac.abort();
      return Promise.resolve({ events: [], cursor: "" });
    });

    for await (const _ of ns.listen(
      "dest1",
      { maxEvents: 10, waitSeconds: 30 },
      ac.signal
    )) {
      // no events expected
    }

    expect(client.pollEvents).toHaveBeenCalledWith(
      expect.objectContaining({ maxEvents: 10, waitSeconds: 30 })
    );
  });

  it("listen stops immediately when signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();

    const events: DeliveryEvent[] = [];
    for await (const event of ns.listen("dest1", {}, ac.signal)) {
      events.push(event);
    }

    expect(client.pollEvents).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("listen propagates errors from pollEvents", async () => {
    client.pollEvents.mockRejectedValueOnce(new Error("network failure"));

    const gen = ns.listen("dest1");
    await expect(gen.next()).rejects.toThrow("network failure");
  });
});
