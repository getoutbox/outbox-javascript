import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelsNamespace } from "./channels.js";

const protoChannel = {
  name: "channels/whatsapp",
  capabilities: undefined,
  createTime: undefined,
};

describe("ChannelsNamespace", () => {
  let client: { listChannels: ReturnType<typeof vi.fn> };
  let ns: ChannelsNamespace;

  beforeEach(() => {
    client = {
      listChannels: vi.fn().mockResolvedValue({
        channels: [protoChannel],
        nextPageToken: "",
        totalSize: BigInt(1),
      }),
    };
    ns = new ChannelsNamespace(client as any);
  });

  it("list maps channels array and converts totalSize to number", async () => {
    const result = await ns.list();
    expect(client.listChannels).toHaveBeenCalledWith({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("whatsapp");
    expect(result.totalSize).toBe(1);
  });

  it("list passes pageSize and pageToken through", async () => {
    await ns.list({ pageSize: 5, pageToken: "tok1" });
    expect(client.listChannels).toHaveBeenCalledWith({
      pageSize: 5,
      pageToken: "tok1",
    });
  });

  it("list returns nextPageToken when server provides one", async () => {
    client.listChannels.mockResolvedValue({
      channels: [],
      nextPageToken: "next1",
      totalSize: BigInt(0),
    });
    const result = await ns.list();
    expect(result.nextPageToken).toBe("next1");
  });

  it("list returns empty items and zero totalSize when no channels exist", async () => {
    client.listChannels.mockResolvedValue({
      channels: [],
      nextPageToken: "",
      totalSize: BigInt(0),
    });
    const result = await ns.list();
    expect(result.items).toHaveLength(0);
    expect(result.totalSize).toBe(0);
    expect(result.nextPageToken).toBeUndefined();
  });
});
