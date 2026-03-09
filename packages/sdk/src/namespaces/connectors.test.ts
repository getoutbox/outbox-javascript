import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorsNamespace } from "./connectors.js";

const protoAccount = {
  name: "accounts/acc1",
  contactId: "c1",
  externalId: "ext1",
  metadata: {},
  source: 0,
  createTime: undefined,
  updateTime: undefined,
};

const protoConnector = {
  name: "connectors/conn1",
  account: protoAccount,
  state: 1,
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
      totalSize: BigInt(1),
    }),
    updateConnector: vi.fn().mockResolvedValue({ connector: protoConnector }),
    deleteConnector: vi.fn().mockResolvedValue({}),
    reauthorizeConnector: vi.fn().mockResolvedValue({
      authorizationUrl: "https://auth.example.com/oauth",
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
    const channelConfig = { case: "whatsapp" as const, value: {} as any };
    await ns.create({ channelConfig });
    expect(client.createConnector).toHaveBeenCalledWith({
      connector: {
        channelConfig,
        tags: undefined,
      },
      requestId: undefined,
    });
  });

  it("create returns connector and authorizationUrl", async () => {
    client.createConnector.mockResolvedValue({
      connector: protoConnector,
      authorizationUrl: "https://auth.example.com/oauth",
    });
    const channelConfig = { case: "whatsapp" as const, value: {} as any };
    const result = await ns.create({ channelConfig });
    expect(result.connector.id).toBe("conn1");
    expect(result.authorizationUrl).toBe("https://auth.example.com/oauth");
  });

  it("create returns undefined authorizationUrl when empty", async () => {
    const channelConfig = { case: "whatsapp" as const, value: {} as any };
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
      totalSize: BigInt(1),
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
    const channelConfig = { case: "whatsapp" as const, value: {} as any };
    await ns.update({ id: "conn1", channelConfig });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("whatsapp");
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

  it("reauthorize calls reauthorizeConnector and returns authorizationUrl", async () => {
    const result = await ns.reauthorize("conn1");
    expect(client.reauthorizeConnector).toHaveBeenCalledWith({
      name: "connectors/conn1",
    });
    expect(result.authorizationUrl).toBe("https://auth.example.com/oauth");
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
    const channelConfig = { case: "whatsapp" as const, value: {} as any };
    await expect(ns.create({ channelConfig })).rejects.toThrow(
      "createConnector"
    );
  });

  it("throws when server returns no connector on update", async () => {
    client.updateConnector.mockResolvedValue({ connector: undefined });
    await expect(ns.update({ id: "conn1" })).rejects.toThrow("updateConnector");
  });

  it("update includes both tags and channelConfig in field mask simultaneously", async () => {
    const channelConfig = { case: "whatsapp" as const, value: {} as any };
    await ns.update({ id: "conn1", tags: ["new"], channelConfig });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("tags");
    expect(call.updateMask.paths).toContain("whatsapp");
  });

  it("update omits channelConfig from field mask when not provided", async () => {
    await ns.update({ id: "conn1", tags: ["a"] });
    const call = client.updateConnector.mock.calls[0][0];
    expect(call.updateMask.paths).toContain("tags");
    expect(call.updateMask.paths).not.toContain("whatsapp");
  });

  it("reauthorize returns undefined authorizationUrl when server returns empty string", async () => {
    client.reauthorizeConnector.mockResolvedValue({ authorizationUrl: "" });
    const result = await ns.reauthorize("conn1");
    expect(result.authorizationUrl).toBeUndefined();
  });
});
