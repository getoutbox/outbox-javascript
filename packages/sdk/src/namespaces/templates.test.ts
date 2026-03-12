import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatesNamespace } from "./templates.js";

const protoTemplate = {
  name: "connectors/conn1/templates/tmpl1",
  templateName: "Hello",
  language: "en_US",
  category: 1,
  componentsJson: "[]",
  status: 2,
  rejectionReason: "",
  externalId: "ext-1",
  createTime: undefined,
  updateTime: undefined,
};

function makeClient() {
  return {
    createTemplate: vi.fn().mockResolvedValue({ template: protoTemplate }),
    getTemplate: vi.fn().mockResolvedValue({ template: protoTemplate }),
    listTemplates: vi.fn().mockResolvedValue({
      templates: [protoTemplate],
      nextPageToken: "",
      totalSize: 1,
    }),
    deleteTemplate: vi.fn().mockResolvedValue({}),
  };
}

describe("TemplatesNamespace", () => {
  let client: ReturnType<typeof makeClient>;
  let ns: TemplatesNamespace;

  beforeEach(() => {
    client = makeClient();
    ns = new TemplatesNamespace(client as any);
  });

  it("create sends connectors/<connectorId> as parent", async () => {
    await ns.create("conn1", {
      templateName: "Hello",
      language: "en_US",
      category: 1,
      componentsJson: "[]",
    });
    expect(client.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ parent: "connectors/conn1" })
    );
  });

  it("create returns mapped template with connectorId and id", async () => {
    const result = await ns.create("conn1", {
      templateName: "Hello",
      language: "en_US",
      category: 1,
      componentsJson: "[]",
    });
    expect(result.connectorId).toBe("conn1");
    expect(result.id).toBe("tmpl1");
  });

  it("get sends connectors/<connectorId>/templates/<templateId> as name", async () => {
    await ns.get("conn1", "tmpl1");
    expect(client.getTemplate).toHaveBeenCalledWith({
      name: "connectors/conn1/templates/tmpl1",
    });
  });

  it("get returns mapped template with connectorId and id", async () => {
    const result = await ns.get("conn1", "tmpl1");
    expect(result.connectorId).toBe("conn1");
    expect(result.id).toBe("tmpl1");
  });

  it("list sends connectors/<connectorId> as parent", async () => {
    await ns.list("conn1");
    expect(client.listTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ parent: "connectors/conn1" })
    );
  });

  it("list forwards pageSize and pageToken to client when provided", async () => {
    await ns.list("conn1", { pageSize: 10, pageToken: "tok-abc" });
    expect(client.listTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 10, pageToken: "tok-abc" })
    );
  });

  it("list returns items mapped correctly", async () => {
    const result = await ns.list("conn1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].connectorId).toBe("conn1");
    expect(result.items[0].id).toBe("tmpl1");
    expect(result.totalSize).toBe(1);
  });

  it("list returns nextPageToken when server returns one", async () => {
    client.listTemplates.mockResolvedValue({
      templates: [],
      nextPageToken: "tok1",
      totalSize: 0,
    });
    const result = await ns.list("conn1");
    expect(result.nextPageToken).toBe("tok1");
  });

  it("list returns undefined nextPageToken when server returns empty string", async () => {
    const result = await ns.list("conn1");
    expect(result.nextPageToken).toBeUndefined();
  });

  it("delete sends connectors/<connectorId>/templates/<templateId> as name", async () => {
    await ns.delete("conn1", "tmpl1");
    expect(client.deleteTemplate).toHaveBeenCalledWith({
      name: "connectors/conn1/templates/tmpl1",
    });
  });

  it("throws when server returns no template on create", async () => {
    client.createTemplate.mockResolvedValue({ template: undefined });
    await expect(
      ns.create("conn1", {
        templateName: "Hello",
        language: "en_US",
        category: 1,
        componentsJson: "[]",
      })
    ).rejects.toThrow();
  });

  it("throws when server returns no template on get", async () => {
    client.getTemplate.mockResolvedValue({ template: undefined });
    await expect(ns.get("conn1", "tmpl1")).rejects.toThrow();
  });
});
