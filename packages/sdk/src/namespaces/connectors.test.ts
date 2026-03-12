import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bufbuild/protobuf/wkt", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@bufbuild/protobuf/wkt")>();
  return {
    ...actual,
    anyUnpack: vi.fn(),
  };
});

import { anyUnpack } from "@bufbuild/protobuf/wkt";
import { ConnectorsNamespace } from "./connectors.js";

const protoConnector = {
  name: "connectors/conn1",
  kind: 0,
  state: 1,
  readiness: 0,
  provisionedResources: [],
  webhookUrl: "",
  displayName: "",
  channelConfig: { case: undefined, value: undefined },
  tags: ["prod"],
  errorMessage: "",
  createTime: undefined,
  updateTime: undefined,
};

function makeClient() {
  return {
    createConnector: vi
      .fn()
      .mockResolvedValue({ connector: protoConnector, authorizationUrl: "" }),
    getConnector: vi.fn().mockResolvedValue({ connector: protoConnector }),
    listConnectors: vi.fn().mockResolvedValue({
      connectors: [protoConnector],
      nextPageToken: "",
      totalSize: 1,
    }),
    updateConnector: vi.fn().mockResolvedValue({ connector: protoConnector }),
    deleteConnector: vi.fn().mockResolvedValue({}),
    reauthorizeConnector: vi.fn().mockResolvedValue({
      connector: protoConnector,
      authorizationUrl: "https://auth.example.com/oauth",
    }),
    activateConnector: vi.fn().mockResolvedValue({ connector: protoConnector }),
    deactivateConnector: vi
      .fn()
      .mockResolvedValue({ connector: protoConnector }),
    verifyConnector: vi.fn().mockResolvedValue({ connector: protoConnector }),
    detachProvisionedResource: vi
      .fn()
      .mockResolvedValue({ connector: protoConnector }),
    createManagedConnector: vi.fn().mockResolvedValue({
      done: false,
      result: { case: undefined, value: undefined },
      name: "operations/op1",
    }),
  };
}

describe("ConnectorsNamespace", () => {
  let client: ReturnType<typeof makeClient>;
  let ns: ConnectorsNamespace;

  beforeEach(() => {
    client = makeClient();
    ns = new ConnectorsNamespace(client as any);
  });

  it("create sends channelConfig without account field", async () => {
    const channelConfig = { case: "outboxWhatsapp" as const, value: {} as any };
    await ns.create({ channelConfig });
    expect(client.createConnector).toHaveBeenCalledWith({
      connector: {
        channelConfig,
        tags: undefined,
      },
      requestId: undefined,
      consentAcknowledged: undefined,
    });
  });

  it("create returns connector and authorizationUrl", async () => {
    client.createConnector.mockResolvedValue({
      connector: protoConnector,
      authorizationUrl: "https://auth.example.com/oauth",
    });
    const channelConfig = { case: "outboxWhatsapp" as const, value: {} as any };
    const result = await ns.create({ channelConfig });
    expect(result.connector.id).toBe("conn1");
    expect(result.authorizationUrl).toBe("https://auth.example.com/oauth");
  });

  it("create returns undefined authorizationUrl when empty", async () => {
    const channelConfig = { case: "outboxWhatsapp" as const, value: {} as any };
    const result = await ns.create({ channelConfig });
    expect(result.authorizationUrl).toBeUndefined();
  });

  it("create forwards tags and requestId", async () => {
    const channelConfig = { case: undefined, value: undefined } as any;
    await ns.create({
      channelConfig,
      tags: ["prod"],
      requestId: "req-1",
    });
    expect(client.createConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        connector: expect.objectContaining({ tags: ["prod"] }),
        requestId: "req-1",
      })
    );
  });

  it("create forwards consentAcknowledged", async () => {
    const channelConfig = { case: undefined, value: undefined } as any;
    await ns.create({ channelConfig, consentAcknowledged: true });
    expect(client.createConnector).toHaveBeenCalledWith(
      expect.objectContaining({ consentAcknowledged: true })
    );
  });

  it("get sends connectors/<id> as name", async () => {
    const result = await ns.get("conn1");
    expect(client.getConnector).toHaveBeenCalledWith({
      name: "connectors/conn1",
    });
    expect(result.id).toBe("conn1");
  });

  it("list maps connectors array and totalSize", async () => {
    const result = await ns.list();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("conn1");
    expect(result.totalSize).toBe(1);
  });

  it("list forwards filter, orderBy, pageSize, and pageToken to client", async () => {
    await ns.list({
      filter: "state == 1",
      orderBy: "create_time desc",
      pageSize: 25,
      pageToken: "tok-abc",
    });
    expect(client.listConnectors).toHaveBeenCalledWith({
      filter: "state == 1",
      orderBy: "create_time desc",
      pageSize: 25,
      pageToken: "tok-abc",
    });
  });

  it("list returns nextPageToken when server returns one", async () => {
    client.listConnectors.mockResolvedValue({
      connectors: [protoConnector],
      nextPageToken: "tok1",
      totalSize: 1,
    });
    const result = await ns.list();
    expect(result.nextPageToken).toBe("tok1");
  });

  it("list returns undefined nextPageToken when server returns empty string", async () => {
    const result = await ns.list();
    expect(result.nextPageToken).toBeUndefined();
  });

  it("update includes tags in field mask when provided", async () => {
    await ns.update({ id: "conn1", tags: ["new"] });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("tags");
  });

  it("update omits tags from field mask when not provided", async () => {
    await ns.update({ id: "conn1" });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).not.toContain("tags");
  });

  it("update includes channelConfig path in field mask when provided", async () => {
    const channelConfig = { case: "outboxWhatsapp" as const, value: {} as any };
    await ns.update({ id: "conn1", channelConfig });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("outbox_whatsapp");
  });

  it("update converts multi-word camelCase channelConfig case to snake_case in field mask", async () => {
    const cases: Array<{ case: string; expected: string }> = [
      { case: "googleChat", expected: "google_chat" },
      { case: "appleMessages", expected: "apple_messages" },
      { case: "inApp", expected: "in_app" },
      { case: "zoomChat", expected: "zoom_chat" },
      { case: "webPush", expected: "web_push" },
    ];
    for (const { case: channelCase, expected } of cases) {
      client.updateConnector.mockClear();
      await ns.update({
        id: "conn1",
        channelConfig: { case: channelCase as any, value: {} as any },
      });
      const call = client.updateConnector.mock.calls[0][0];
      expect(call.updateMask.paths).toContain(expected);
    }
  });

  it("update omits channelConfig from field mask when case is undefined", async () => {
    await ns.update({
      id: "conn1",
      channelConfig: { case: undefined, value: undefined } as any,
    });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).not.toContain("channel_config");
    expect(call.updateMask.paths).not.toContain("whatsapp_config");
  });

  it("update sends connector name correctly", async () => {
    await ns.update({ id: "conn1" });
    expect(client.updateConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        connector: expect.objectContaining({ name: "connectors/conn1" }),
      })
    );
  });

  it("delete calls deleteConnector with correct resource name", async () => {
    await ns.delete("conn1");
    expect(client.deleteConnector).toHaveBeenCalledWith({
      name: "connectors/conn1",
    });
  });

  it("reauthorize calls reauthorizeConnector and returns connector and authorizationUrl", async () => {
    const result = await ns.reauthorize("conn1");
    expect(client.reauthorizeConnector).toHaveBeenCalledWith({
      name: "connectors/conn1",
    });
    expect(result.connector.id).toBe("conn1");
    expect(result.authorizationUrl).toBe("https://auth.example.com/oauth");
  });

  it("reauthorize returns undefined authorizationUrl when server returns empty string", async () => {
    client.reauthorizeConnector.mockResolvedValue({
      connector: protoConnector,
      authorizationUrl: "",
    });
    const result = await ns.reauthorize("conn1");
    expect(result.authorizationUrl).toBeUndefined();
  });

  it("throws when server returns no connector on get", async () => {
    client.getConnector.mockResolvedValue({ connector: undefined });
    await expect(ns.get("conn1")).rejects.toThrow("getConnector");
  });

  it("throws when server returns no connector on create", async () => {
    client.createConnector.mockResolvedValue({
      connector: undefined,
      authorizationUrl: "",
    });
    const channelConfig = { case: "outboxWhatsapp" as const, value: {} as any };
    await expect(ns.create({ channelConfig })).rejects.toThrow(
      "createConnector"
    );
  });

  it("throws when server returns no connector on update", async () => {
    client.updateConnector.mockResolvedValue({ connector: undefined });
    await expect(ns.update({ id: "conn1" })).rejects.toThrow("updateConnector");
  });

  it("throws when server returns no connector on activate", async () => {
    client.activateConnector.mockResolvedValue({ connector: undefined });
    await expect(ns.activate("conn1")).rejects.toThrow("activateConnector");
  });

  it("throws when server returns no connector on deactivate", async () => {
    client.deactivateConnector.mockResolvedValue({ connector: undefined });
    await expect(ns.deactivate("conn1")).rejects.toThrow("deactivateConnector");
  });

  it("throws when server returns no connector on verify", async () => {
    client.verifyConnector.mockResolvedValue({ connector: undefined });
    await expect(ns.verify("conn1", "123456")).rejects.toThrow(
      "verifyConnector"
    );
  });

  it("throws when server returns no connector on detach", async () => {
    client.detachProvisionedResource.mockResolvedValue({
      connector: undefined,
    });
    await expect(ns.detach("conn1")).rejects.toThrow(
      "detachProvisionedResource"
    );
  });

  it("throws when server returns no connector on reauthorize", async () => {
    client.reauthorizeConnector.mockResolvedValue({
      connector: undefined,
      authorizationUrl: "",
    });
    await expect(ns.reauthorize("conn1")).rejects.toThrow(
      "reauthorizeConnector"
    );
  });

  it("update includes both tags and channelConfig in field mask simultaneously", async () => {
    const channelConfig = { case: "outboxWhatsapp" as const, value: {} as any };
    await ns.update({ id: "conn1", tags: ["new"], channelConfig });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("tags");
    expect(call.updateMask.paths).toContain("outbox_whatsapp");
  });

  it("update omits channelConfig from field mask when not provided", async () => {
    await ns.update({ id: "conn1", tags: ["a"] });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("tags");
    expect(call.updateMask.paths).not.toContain("outbox_whatsapp");
  });

  it("verify calls verifyConnector with code and password", async () => {
    const result = await ns.verify("conn1", "123456", "pass");
    expect(client.verifyConnector).toHaveBeenCalledWith({
      name: "connectors/conn1",
      code: "123456",
      password: "pass",
    });
    expect(result.id).toBe("conn1");
  });

  it("verify uses empty string for omitted password", async () => {
    await ns.verify("conn1", "123456");
    expect(client.verifyConnector).toHaveBeenCalledWith(
      expect.objectContaining({ password: "" })
    );
  });

  it("detach calls detachProvisionedResource and returns connector", async () => {
    const result = await ns.detach("conn1");
    expect(client.detachProvisionedResource).toHaveBeenCalledWith({
      name: "connectors/conn1",
    });
    expect(result.id).toBe("conn1");
  });

  it("createManaged throws when no operations client is provided", async () => {
    await expect(ns.createManaged({ channel: "sms" })).rejects.toThrow(
      "operations client"
    );
  });

  describe("createManaged", () => {
    it("forwards channel, tags, and requestId to createManagedConnector", async () => {
      const opsClient = { getOperation: vi.fn() };
      const ns2 = new ConnectorsNamespace(client as any, opsClient as any);
      (client as any).createManagedConnector = vi
        .fn()
        .mockRejectedValue(new Error("rpc error"));
      await expect(
        ns2.createManaged({ channel: "sms", tags: ["t1"], requestId: "r1" })
      ).rejects.toThrow("rpc error");
      expect((client as any).createManagedConnector).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "sms",
          tags: ["t1"],
          requestId: "r1",
        })
      );
    });

    it("forwards webhookUrl and filters to createManagedConnector", async () => {
      const opsClient = { getOperation: vi.fn() };
      const ns2 = new ConnectorsNamespace(client as any, opsClient as any);
      (client as any).createManagedConnector = vi
        .fn()
        .mockRejectedValue(new Error("rpc error"));
      await expect(
        ns2.createManaged({
          channel: "sms",
          webhookUrl: "https://example.com/hook",
          filters: { country: "US" },
        })
      ).rejects.toThrow("rpc error");
      expect((client as any).createManagedConnector).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookUrl: "https://example.com/hook",
          filters: { country: "US" },
        })
      );
    });

    it("throws with error message when operation result is error", async () => {
      const opsClient = { getOperation: vi.fn() };
      const ns2 = new ConnectorsNamespace(client as any, opsClient as any);
      (client as any).createManagedConnector = vi.fn().mockResolvedValue({
        done: true,
        result: {
          case: "error",
          value: { message: "provisioning failed", code: 13 },
        },
        name: "operations/op1",
      });
      await expect(ns2.createManaged({ channel: "sms" })).rejects.toThrow(
        "provisioning failed"
      );
    });

    it("returns mapped connector when operation succeeds", async () => {
      const opsClient = { getOperation: vi.fn() };
      const ns2 = new ConnectorsNamespace(client as any, opsClient as any);
      const fakeAny = { typeUrl: "type.googleapis.com/outbox.v1.Connector" };
      (client as any).createManagedConnector = vi.fn().mockResolvedValue({
        done: true,
        result: { case: "response", value: fakeAny },
        name: "operations/op1",
      });
      vi.mocked(anyUnpack).mockReturnValue(protoConnector as any);
      const result = await ns2.createManaged({ channel: "sms" });
      expect(anyUnpack).toHaveBeenCalledWith(fakeAny, expect.anything());
      expect(result.id).toBe("conn1");
    });

    it("throws when anyUnpack returns undefined (wrong type URL)", async () => {
      const opsClient = { getOperation: vi.fn() };
      const ns2 = new ConnectorsNamespace(client as any, opsClient as any);
      (client as any).createManagedConnector = vi.fn().mockResolvedValue({
        done: true,
        result: {
          case: "response",
          value: { typeUrl: "type.googleapis.com/google.protobuf.Empty" },
        },
        name: "operations/op1",
      });
      vi.mocked(anyUnpack).mockReturnValue(undefined);
      await expect(ns2.createManaged({ channel: "sms" })).rejects.toThrow(
        "failed to unpack Connector"
      );
    });

    it("polls getOperation until done", async () => {
      vi.useFakeTimers();
      try {
        const opsClient = {
          getOperation: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              result: { case: undefined, value: undefined },
              name: "operations/op1",
            })
            .mockResolvedValueOnce({
              done: true,
              result: {
                case: "error",
                value: { message: "done after poll", code: 13 },
              },
              name: "operations/op1",
            }),
        };
        const ns2 = new ConnectorsNamespace(client as any, opsClient as any);
        (client as any).createManagedConnector = vi.fn().mockResolvedValue({
          done: false,
          result: { case: undefined, value: undefined },
          name: "operations/op1",
        });
        // Attach .catch before starting so the rejection is always handled
        let caughtError: unknown;
        const promise = ns2.createManaged({ channel: "sms" }).catch((e) => {
          caughtError = e;
        });
        // Advance past the poll delay so getOperation is called
        await vi.runAllTimersAsync();
        await promise;
        expect(String(caughtError)).toContain("done after poll");
        expect(opsClient.getOperation).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
