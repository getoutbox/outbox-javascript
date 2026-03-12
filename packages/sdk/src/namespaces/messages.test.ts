import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageDeletionScope, MessagePartDisposition } from "../types.js";
import { MessagesNamespace } from "./messages.js";

const protoAccount = {
  name: "accounts/acc1",
  contactId: "c1",
  externalId: "ext1",
  metadata: {},
  source: 0,
  createTime: undefined,
  updateTime: undefined,
};

const protoMessage = {
  name: "messages/msg1",
  account: protoAccount,
  recipient: "accounts/rec1",
  parts: [],
  metadata: {},
  direction: 2,
  createTime: undefined,
  deliverTime: undefined,
  replyTo: "",
  groupId: "",
  replaced: "",
  scope: 0,
  editNumber: BigInt(0),
  deleteTime: undefined,
};

const protoDelivery = {
  message: "messages/msg1",
  account: protoAccount,
  status: 1,
  errorCode: "",
  errorMessage: "",
  statusChangeTime: undefined,
};

function makeClient() {
  return {
    createMessage: vi
      .fn()
      .mockResolvedValue({ message: protoMessage, delivery: protoDelivery }),
    updateMessage: vi.fn().mockResolvedValue({ message: protoMessage }),
    deleteMessage: vi.fn().mockResolvedValue({ message: protoMessage }),
    listMessages: vi.fn().mockResolvedValue({
      messages: [protoMessage],
      nextPageToken: "",
      totalSize: BigInt(1),
    }),
    sendReadReceipt: vi.fn().mockResolvedValue({}),
    sendTypingIndicator: vi.fn().mockResolvedValue({}),
  };
}

describe("MessagesNamespace", () => {
  let client: ReturnType<typeof makeClient>;
  let ns: MessagesNamespace;

  beforeEach(() => {
    client = makeClient();
    ns = new MessagesNamespace(client as any);
  });

  // -------------------------
  // send
  // -------------------------

  describe("send", () => {
    it("maps connectorId to connector resource name", async () => {
      await ns.send({ connectorId: "conn1", recipientId: "acc1", parts: [] });
      expect(client.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ connector: "connectors/conn1" })
      );
    });

    it("maps recipientId to accounts/<id> inside message", async () => {
      await ns.send({ connectorId: "conn1", recipientId: "acc1", parts: [] });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.recipient).toBe("accounts/acc1");
    });

    it("omits requestId when none is provided", async () => {
      await ns.send({ connectorId: "c", recipientId: "r", parts: [] });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.requestId).toBeUndefined();
    });

    it("uses provided requestId when given", async () => {
      await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
        requestId: "my-req",
      });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.requestId).toBe("my-req");
    });

    it("maps replyToMessageId to messages/<id>", async () => {
      await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
        replyToMessageId: "msg0",
      });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.replyTo).toBe("messages/msg0");
    });

    it("leaves replyTo undefined when replyToMessageId is absent", async () => {
      await ns.send({ connectorId: "c", recipientId: "r", parts: [] });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.replyTo).toBeUndefined();
    });

    it("maps replacedMessageId to messages/<id>", async () => {
      await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
        replacedMessageId: "msg0",
      });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.replaced).toBe("messages/msg0");
    });

    it("leaves replaced undefined when replacedMessageId is absent", async () => {
      await ns.send({ connectorId: "c", recipientId: "r", parts: [] });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.replaced).toBeUndefined();
    });

    it("maps both replyToMessageId and replacedMessageId simultaneously", async () => {
      await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
        replyToMessageId: "msg0",
        replacedMessageId: "msg1",
      });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.replyTo).toBe("messages/msg0");
      expect(call.message.replaced).toBe("messages/msg1");
    });

    it("maps content parts to proto source oneof format", async () => {
      const content = new TextEncoder().encode("hello");
      const parts = [{ contentType: "text/plain", content }];
      await ns.send({ connectorId: "c", recipientId: "r", parts });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.parts).toEqual([
        {
          contentType: "text/plain",
          disposition: undefined,
          filename: undefined,
          source: { case: "content", value: content },
        },
      ]);
    });

    it("maps url parts to proto source oneof format", async () => {
      const parts = [
        { contentType: "image/png", url: "https://example.com/img.png" },
      ];
      await ns.send({ connectorId: "c", recipientId: "r", parts });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.parts).toEqual([
        {
          contentType: "image/png",
          disposition: undefined,
          filename: undefined,
          source: { case: "url", value: "https://example.com/img.png" },
        },
      ]);
    });

    it("maps mixed content and url parts in a single message", async () => {
      const content = new TextEncoder().encode("caption");
      const parts = [
        { contentType: "text/plain", content },
        { contentType: "image/jpeg", url: "https://example.com/photo.jpg" },
      ];
      await ns.send({ connectorId: "c", recipientId: "r", parts });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.parts).toHaveLength(2);
      expect(call.message.parts[0].source).toEqual({
        case: "content",
        value: content,
      });
      expect(call.message.parts[1].source).toEqual({
        case: "url",
        value: "https://example.com/photo.jpg",
      });
    });

    it("forwards filename and disposition on content parts", async () => {
      const content = new Uint8Array([1, 2, 3]);
      const parts = [
        {
          contentType: "application/pdf",
          content,
          filename: "doc.pdf",
          disposition: MessagePartDisposition.ATTACHMENT,
        },
      ];
      await ns.send({ connectorId: "c", recipientId: "r", parts });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.parts[0].filename).toBe("doc.pdf");
      expect(call.message.parts[0].disposition).toBe(
        MessagePartDisposition.ATTACHMENT
      );
    });

    it("returns mapped message and delivery", async () => {
      const result = await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
      });
      expect(result.message.id).toBe("msg1");
      expect(result.delivery?.messageId).toBe("msg1");
    });

    it("returns undefined delivery when server returns no delivery", async () => {
      client.createMessage.mockResolvedValue({
        message: protoMessage,
        delivery: undefined,
      });
      const result = await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
      });
      expect(result.delivery).toBeUndefined();
    });

    it("forwards metadata and groupId inside message", async () => {
      await ns.send({
        connectorId: "c",
        recipientId: "r",
        parts: [],
        metadata: { key: "val" },
        groupId: "grp1",
      });
      const call = client.createMessage.mock.calls[0][0];
      expect(call.message.metadata).toEqual({ key: "val" });
      expect(call.message.groupId).toBe("grp1");
    });
  });

  // -------------------------
  // update
  // -------------------------

  describe("update", () => {
    it("sends message name and parts in proto source oneof format, derives field mask", async () => {
      const content = new Uint8Array([1, 2, 3]);
      const parts = [{ contentType: "text/plain", content }];
      await ns.update({ id: "msg1", parts });
      expect(client.updateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            name: "messages/msg1",
            parts: [
              {
                contentType: "text/plain",
                disposition: undefined,
                filename: undefined,
                source: { case: "content", value: content },
              },
            ],
          }),
          updateMask: { paths: ["parts"] },
        })
      );
    });

    it("maps url parts to proto source oneof format in update", async () => {
      const parts = [
        { contentType: "image/png", url: "https://example.com/img.png" },
      ];
      await ns.update({ id: "msg1", parts });
      const call = client.updateMessage.mock.calls[0][0];
      expect(call.message.parts).toEqual([
        {
          contentType: "image/png",
          disposition: undefined,
          filename: undefined,
          source: { case: "url", value: "https://example.com/img.png" },
        },
      ]);
    });

    it("forwards requestId to updateMessage", async () => {
      await ns.update({ id: "msg1", requestId: "req-456" });
      const call = client.updateMessage.mock.calls[0][0];
      expect(call.requestId).toBe("req-456");
    });

    it("throws when server returns no message", async () => {
      client.updateMessage.mockResolvedValue({ message: undefined });
      await expect(ns.update({ id: "msg1" })).rejects.toThrow("update");
    });
  });

  // -------------------------
  // delete
  // -------------------------

  describe("delete", () => {
    it("sends correct name and scope", async () => {
      await ns.delete({ id: "msg1", deletionScope: 1 });
      expect(client.deleteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "messages/msg1",
          scope: 1,
        })
      );
    });

    it("sends FOR_SENDER scope (1) correctly", async () => {
      await ns.delete({
        id: "msg1",
        deletionScope: MessageDeletionScope.FOR_SENDER,
      });
      expect(client.deleteMessage).toHaveBeenCalledWith(
        expect.objectContaining({ scope: MessageDeletionScope.FOR_SENDER })
      );
    });

    it("sends FOR_EVERYONE scope (2) correctly", async () => {
      await ns.delete({
        id: "msg1",
        deletionScope: MessageDeletionScope.FOR_EVERYONE,
      });
      expect(client.deleteMessage).toHaveBeenCalledWith(
        expect.objectContaining({ scope: MessageDeletionScope.FOR_EVERYONE })
      );
    });

    it("forwards requestId to deleteMessage", async () => {
      await ns.delete({ id: "msg1", deletionScope: 0, requestId: "req-del" });
      const call = client.deleteMessage.mock.calls[0][0];
      expect(call.requestId).toBe("req-del");
    });

    it("throws when server returns no message", async () => {
      client.deleteMessage.mockResolvedValue({ message: undefined });
      await expect(ns.delete({ id: "msg1", deletionScope: 0 })).rejects.toThrow(
        "delete"
      );
    });
  });

  // -------------------------
  // list
  // -------------------------

  describe("list", () => {
    it("converts connectorId to parent resource name", async () => {
      const result = await ns.list({ connectorId: "conn1" });
      expect(client.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({ parent: "connectors/conn1" })
      );
      expect(result.items[0].id).toBe("msg1");
      expect(result.totalSize).toBe(1);
    });

    it("returns undefined nextPageToken when server returns empty string", async () => {
      const result = await ns.list({ connectorId: "conn1" });
      expect(result.nextPageToken).toBeUndefined();
    });

    it("passes filter, orderBy, pageSize, pageToken through", async () => {
      await ns.list({
        connectorId: "conn1",
        filter: "direction == 1",
        orderBy: "create_time desc",
        pageSize: 25,
        pageToken: "tok1",
      });
      expect(client.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: "direction == 1",
          orderBy: "create_time desc",
          pageSize: 25,
          pageToken: "tok1",
        })
      );
    });
  });

  // -------------------------
  // markRead
  // -------------------------

  describe("markRead", () => {
    it("maps plain message IDs to messages/<id> resource names", async () => {
      await ns.markRead({
        connectorId: "conn1",
        accountId: "acc1",
        messages: ["m1", "m2"],
      });
      expect(client.sendReadReceipt).toHaveBeenCalledWith({
        connector: "connectors/conn1",
        account: "accounts/acc1",
        messages: ["messages/m1", "messages/m2"],
      });
    });

    it("sends empty messages array when none provided", async () => {
      await ns.markRead({
        connectorId: "conn1",
        accountId: "acc1",
        messages: [],
      });
      expect(client.sendReadReceipt).toHaveBeenCalledWith({
        connector: "connectors/conn1",
        account: "accounts/acc1",
        messages: [],
      });
    });
  });

  // -------------------------
  // typing
  // -------------------------

  describe("typing", () => {
    it("sends correct connector, account, and typing flag", async () => {
      await ns.typing({
        connectorId: "conn1",
        accountId: "acc1",
        typing: true,
      });
      expect(client.sendTypingIndicator).toHaveBeenCalledWith({
        connector: "connectors/conn1",
        account: "accounts/acc1",
        typing: true,
      });
    });
  });

  // -------------------------
  // withTyping
  // -------------------------

  describe("withTyping", () => {
    it("sends typing: true before fn and typing: false after", async () => {
      const calls: boolean[] = [];
      client.sendTypingIndicator.mockImplementation(
        ({ typing }: { typing: boolean }) => {
          calls.push(typing);
          return Promise.resolve({});
        }
      );

      const fn = vi.fn().mockResolvedValue("result");
      const result = await ns.withTyping(
        { connectorId: "c", accountId: "a" },
        fn
      );

      expect(result).toBe("result");
      expect(calls).toEqual([true, false]);
    });

    it("sends typing: false even when fn throws", async () => {
      const calls: boolean[] = [];
      client.sendTypingIndicator.mockImplementation(
        ({ typing }: { typing: boolean }) => {
          calls.push(typing);
          return Promise.resolve({});
        }
      );

      const fn = vi.fn().mockRejectedValue(new Error("boom"));
      await expect(
        ns.withTyping({ connectorId: "c", accountId: "a" }, fn)
      ).rejects.toThrow("boom");

      expect(calls).toEqual([true, false]);
    });
  });

  // -------------------------
  // history
  // -------------------------

  describe("history", () => {
    it("builds correct filter and orderBy for the account", async () => {
      await ns.history({ connectorId: "conn1", accountId: "acc1" });
      expect(client.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: "connectors/conn1",
          filter:
            'account.name == "accounts/acc1" || recipient == "accounts/acc1"',
          orderBy: "create_time asc",
        })
      );
    });

    it("forwards pageSize and pageToken", async () => {
      await ns.history({
        connectorId: "conn1",
        accountId: "acc1",
        pageSize: 20,
        pageToken: "tok1",
      });
      expect(client.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 20, pageToken: "tok1" })
      );
    });
  });
});
