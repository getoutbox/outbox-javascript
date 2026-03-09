import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsNamespace } from "./accounts.js";

const protoAccount = {
  name: "accounts/acc1",
  contactId: "contact1",
  externalId: "ext1",
  metadata: { key: "val" },
  source: 0,
  createTime: undefined,
  updateTime: undefined,
};

function makeClient() {
  return {
    createAccount: vi.fn().mockResolvedValue({ account: protoAccount }),
    getAccount: vi.fn().mockResolvedValue({ account: protoAccount }),
    listAccounts: vi.fn().mockResolvedValue({
      accounts: [protoAccount],
      nextPageToken: "",
      totalSize: BigInt(1),
    }),
    updateAccount: vi.fn().mockResolvedValue({ account: protoAccount }),
    deleteAccount: vi.fn().mockResolvedValue({}),
    resolveAccount: vi.fn().mockResolvedValue({ account: protoAccount }),
    claimAccount: vi.fn().mockResolvedValue({ account: protoAccount }),
  };
}

describe("AccountsNamespace", () => {
  let client: ReturnType<typeof makeClient>;
  let ns: AccountsNamespace;

  beforeEach(() => {
    client = makeClient();
    ns = new AccountsNamespace(client as any);
  });

  it("create sends externalId + contactId + metadata and maps result", async () => {
    const result = await ns.create({
      externalId: "ext1",
      contactId: "contact1",
      metadata: { k: "v" },
    });
    expect(client.createAccount).toHaveBeenCalledWith({
      account: {
        externalId: "ext1",
        contactId: "contact1",
        metadata: { k: "v" },
      },
      requestId: undefined,
    });
    expect(result.id).toBe("acc1");
    expect(result.externalId).toBe("ext1");
  });

  it("create forwards requestId when provided", async () => {
    await ns.create({ externalId: "e", requestId: "req-123" });
    expect(client.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-123" })
    );
  });

  it("get sends accounts/<id> as name", async () => {
    const result = await ns.get("acc1");
    expect(client.getAccount).toHaveBeenCalledWith({ name: "accounts/acc1" });
    expect(result.id).toBe("acc1");
  });

  it("list maps accounts array and converts totalSize to number", async () => {
    const result = await ns.list({ pageSize: 10 });
    expect(client.listAccounts).toHaveBeenCalledWith({ pageSize: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("acc1");
    expect(result.totalSize).toBe(1);
  });

  it("list forwards filter and orderBy to client", async () => {
    await ns.list({
      filter: 'externalId == "ext1"',
      orderBy: "createTime desc",
      pageSize: 25,
    });
    expect(client.listAccounts).toHaveBeenCalledWith({
      filter: 'externalId == "ext1"',
      orderBy: "createTime desc",
      pageSize: 25,
    });
  });

  it("list returns nextPageToken as undefined when server returns empty string", async () => {
    const result = await ns.list();
    expect(result.nextPageToken).toBeUndefined();
  });

  it("list returns nextPageToken when server returns one", async () => {
    client.listAccounts.mockResolvedValue({
      accounts: [],
      nextPageToken: "tok1",
      totalSize: BigInt(0),
    });
    const result = await ns.list();
    expect(result.nextPageToken).toBe("tok1");
  });

  it("update sends account with name and derives field mask (skips id)", async () => {
    await ns.update({ id: "acc1", metadata: { a: "b" } });
    expect(client.updateAccount).toHaveBeenCalledWith({
      account: { name: "accounts/acc1", metadata: { a: "b" } },
      updateMask: { paths: ["metadata"] },
    });
  });

  it("update with only id sends empty field mask", async () => {
    await ns.update({ id: "acc1" });
    expect(client.updateAccount).toHaveBeenCalledWith({
      account: { name: "accounts/acc1" },
      updateMask: { paths: [] },
    });
  });

  it("update returns properly mapped account", async () => {
    const result = await ns.update({ id: "acc1", metadata: { a: "b" } });
    expect(result.id).toBe("acc1");
    expect(result.externalId).toBe("ext1");
  });

  it("delete calls deleteAccount with correct resource name", async () => {
    await ns.delete("acc1");
    expect(client.deleteAccount).toHaveBeenCalledWith({
      name: "accounts/acc1",
    });
  });

  it("resolve sends externalId and returns mapped account", async () => {
    const result = await ns.resolve("ext1");
    expect(client.resolveAccount).toHaveBeenCalledWith({ externalId: "ext1" });
    expect(result.id).toBe("acc1");
  });

  it("claim sends name, contactId, and requestId", async () => {
    await ns.claim({ id: "acc1", contactId: "contact1", requestId: "req-abc" });
    expect(client.claimAccount).toHaveBeenCalledWith({
      name: "accounts/acc1",
      contactId: "contact1",
      requestId: "req-abc",
    });
  });

  it("claim returns properly mapped account", async () => {
    const result = await ns.claim({ id: "acc1", contactId: "contact1" });
    expect(result.id).toBe("acc1");
    expect(result.contactId).toBe("contact1");
  });

  it("create without contactId omits it from the request", async () => {
    await ns.create({ externalId: "ext1" });
    const call = client.createAccount.mock.calls[0][0];
    expect(call.account.contactId).toBeUndefined();
  });

  it("throws a descriptive error when server returns no account", async () => {
    client.getAccount.mockResolvedValue({ account: undefined });
    await expect(ns.get("acc1")).rejects.toThrow("get");
  });

  it("create throws when server returns no account", async () => {
    client.createAccount.mockResolvedValue({ account: undefined });
    await expect(ns.create({ externalId: "ext1" })).rejects.toThrow("create");
  });

  it("update throws when server returns no account", async () => {
    client.updateAccount.mockResolvedValue({ account: undefined });
    await expect(
      ns.update({ id: "acc1", metadata: { a: "b" } })
    ).rejects.toThrow("update");
  });

  it("resolve throws when server returns no account", async () => {
    client.resolveAccount.mockResolvedValue({ account: undefined });
    await expect(ns.resolve("ext1")).rejects.toThrow("resolve");
  });

  it("claim throws when server returns no account", async () => {
    client.claimAccount.mockResolvedValue({ account: undefined });
    await expect(ns.claim({ id: "acc1", contactId: "c1" })).rejects.toThrow(
      "claim"
    );
  });
});
