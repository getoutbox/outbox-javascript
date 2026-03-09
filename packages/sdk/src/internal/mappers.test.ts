import { describe, expect, it } from "vitest";
import {
  mapAccount,
  mapConnector,
  mapDeliveryEvent,
  mapDestination,
  mapMessage,
  mapMessageDelivery,
  mapReadReceipt,
  mapTemplate,
  mapTypingIndicator,
} from "./mappers.js";

// Minimal Timestamp helper
function ts(seconds: number) {
  return { seconds: BigInt(seconds), nanos: 0 };
}

// Reusable proto account fixture (matches ProtoAccount shape)
const protoAccount = {
  name: "accounts/acc1",
  contactId: "contact1",
  externalId: "ext1",
  metadata: { role: "user" },
  source: 0,
  createTime: ts(1000),
  updateTime: ts(2000),
} as any;

// -------------------------
// mapAccount
// -------------------------

describe("mapAccount", () => {
  it("maps all fields", () => {
    const acc = mapAccount(protoAccount);
    expect(acc.id).toBe("acc1");
    expect(acc.contactId).toBe("contact1");
    expect(acc.externalId).toBe("ext1");
    expect(acc.metadata).toEqual({ role: "user" });
    expect(acc.createTime).toEqual(new Date(1_000_000));
    expect(acc.updateTime).toEqual(new Date(2_000_000));
  });

  it("maps contactId to undefined when empty (SOURCE_AUTO accounts)", () => {
    const acc = mapAccount({ ...protoAccount, contactId: "" } as any);
    expect(acc.contactId).toBeUndefined();
  });

  it("copies metadata as a new object", () => {
    const input = { ...protoAccount, metadata: { k: "v" } } as any;
    const acc = mapAccount(input);
    acc.metadata.extra = "x";
    expect(input.metadata).not.toHaveProperty("extra");
  });
});

// -------------------------
// mapConnector
// -------------------------

describe("mapConnector", () => {
  it("maps all fields and extracts connector id", () => {
    const conn = mapConnector({
      name: "connectors/conn1",
      kind: 1,
      state: 1,
      readiness: 1,
      provisionedResources: ["connectors/conn1/provisionedResources/res1"],
      webhookUrl: "https://example.com/webhook",
      displayName: "My Connector",
      channelConfig: { case: undefined, value: undefined },
      tags: ["production"],
      errorMessage: "",
      createTime: ts(100),
      updateTime: ts(200),
    } as any);
    expect(conn.id).toBe("conn1");
    expect(conn.kind).toBe(1);
    expect(conn.readiness).toBe(1);
    expect(conn.provisionedResources).toEqual(["res1"]);
    expect(conn.webhookUrl).toBe("https://example.com/webhook");
    expect(conn.displayName).toBe("My Connector");
    expect(conn.tags).toEqual(["production"]);
    expect(conn.state).toBe(1);
  });

  it("copies tags as a new array", () => {
    const proto = {
      name: "connectors/x",
      kind: 0,
      state: 1,
      readiness: 0,
      provisionedResources: [],
      webhookUrl: "",
      displayName: "",
      channelConfig: { case: undefined, value: undefined },
      tags: ["a"],
    } as any;
    const conn = mapConnector(proto);
    conn.tags.push("b");
    expect(proto.tags).toEqual(["a"]);
  });

  it("maps errorMessage when present", () => {
    const conn = mapConnector({
      name: "connectors/x",
      kind: 0,
      state: 4,
      readiness: 0,
      provisionedResources: [],
      webhookUrl: "",
      displayName: "",
      channelConfig: { case: undefined, value: undefined },
      tags: [],
      errorMessage: "token expired",
    } as any);
    expect(conn.errorMessage).toBe("token expired");
  });

  it("omits errorMessage when empty string", () => {
    const conn = mapConnector({
      name: "connectors/x",
      kind: 0,
      state: 1,
      readiness: 0,
      provisionedResources: [],
      webhookUrl: "",
      displayName: "",
      channelConfig: { case: undefined, value: undefined },
      tags: [],
      errorMessage: "",
    } as any);
    expect(conn.errorMessage).toBeUndefined();
  });
});

// -------------------------
// mapTemplate
// -------------------------

describe("mapTemplate", () => {
  it("parses connectorId and id from resource name", () => {
    const tmpl = mapTemplate({
      name: "connectors/conn1/templates/tmpl1",
      templateName: "Hello World",
      language: "en_US",
      category: 1,
      componentsJson: "[]",
      status: 2,
      rejectionReason: "Policy violation",
      externalId: "ext-1",
      createTime: ts(100),
      updateTime: ts(200),
    } as any);
    expect(tmpl.connectorId).toBe("conn1");
    expect(tmpl.id).toBe("tmpl1");
    expect(tmpl.templateName).toBe("Hello World");
    expect(tmpl.language).toBe("en_US");
    expect(tmpl.category).toBe(1);
    expect(tmpl.status).toBe(2);
    expect(tmpl.rejectionReason).toBe("Policy violation");
    expect(tmpl.externalId).toBe("ext-1");
    expect(tmpl.createTime).toEqual(new Date(100_000));
    expect(tmpl.updateTime).toEqual(new Date(200_000));
  });

  it("normalizes empty rejectionReason to undefined", () => {
    const tmpl = mapTemplate({
      name: "connectors/conn1/templates/tmpl1",
      templateName: "Hello",
      language: "en_US",
      category: 1,
      componentsJson: "[]",
      status: 2,
      rejectionReason: "",
      externalId: "ext-1",
    } as any);
    expect(tmpl.rejectionReason).toBeUndefined();
  });

  it("normalizes empty externalId to undefined", () => {
    const tmpl = mapTemplate({
      name: "connectors/conn1/templates/tmpl1",
      templateName: "Hello",
      language: "en_US",
      category: 1,
      componentsJson: "[]",
      status: 2,
      rejectionReason: "",
      externalId: "",
    } as any);
    expect(tmpl.externalId).toBeUndefined();
  });

  it("throws on a malformed resource name", () => {
    expect(() => mapTemplate({ name: "bad/name" } as any)).toThrow(
      'Invalid template resource name: "bad/name"'
    );
  });
});

// -------------------------
// mapMessage
// -------------------------

const baseProtoMsg = {
  name: "messages/msg1",
  account: protoAccount,
  recipient: "accounts/rec1",
  parts: [
    {
      contentType: "text/plain",
      disposition: 1,
      source: { case: "content", value: new TextEncoder().encode("hello") },
      filename: "",
    },
  ],
  metadata: { tag: "test" },
  direction: 1,
  createTime: ts(500),
  deliverTime: undefined,
  replyTo: "",
  groupId: "",
  replaced: "",
  scope: 0,
  editNumber: BigInt(0),
  deleteTime: undefined,
} as any;

describe("mapMessage", () => {
  it("maps basic fields", () => {
    const msg = mapMessage(baseProtoMsg);
    expect(msg.id).toBe("msg1");
    expect(msg.recipientId).toBe("rec1");
    expect(msg.direction).toBe(1);
    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0].contentType).toBe("text/plain");
    const part0 = msg.parts[0];
    if (!("content" in part0)) {
      throw new Error("expected content part");
    }
    expect(part0.content).toBeDefined();
  });

  it("converts editNumber bigint to number", () => {
    const msg = mapMessage({ ...baseProtoMsg, editNumber: BigInt(42) } as any);
    expect(msg.editNumber).toBe(42);
    expect(typeof msg.editNumber).toBe("number");
  });

  it("omits deletionScope when scope is UNSPECIFIED (0)", () => {
    const msg = mapMessage(baseProtoMsg);
    expect(msg.deletionScope).toBeUndefined();
  });

  it("maps deletionScope when non-zero", () => {
    const msg = mapMessage({ ...baseProtoMsg, scope: 1 } as any);
    expect(msg.deletionScope).toBe(1);
  });

  it("maps optional replyToMessageId when present", () => {
    const msg = mapMessage({
      ...baseProtoMsg,
      replyTo: "messages/msg0",
    } as any);
    expect(msg.replyToMessageId).toBe("msg0");
  });

  it("leaves replyToMessageId undefined when empty", () => {
    const msg = mapMessage(baseProtoMsg);
    expect(msg.replyToMessageId).toBeUndefined();
  });

  it("maps optional groupId when present", () => {
    const msg = mapMessage({ ...baseProtoMsg, groupId: "group1" } as any);
    expect(msg.groupId).toBe("group1");
  });

  it("maps optional replacedMessageId when present", () => {
    const msg = mapMessage({
      ...baseProtoMsg,
      replaced: "messages/msg0",
    } as any);
    expect(msg.replacedMessageId).toBe("msg0");
  });

  it("omits disposition when UNSPECIFIED (0)", () => {
    const msg = mapMessage({
      ...baseProtoMsg,
      parts: [
        {
          contentType: "text/plain",
          disposition: 0,
          source: { case: "content", value: new TextEncoder().encode("hi") },
          filename: "",
        },
      ],
    } as any);
    expect(msg.parts[0].disposition).toBeUndefined();
  });

  it("preserves non-zero disposition", () => {
    const msg = mapMessage({
      ...baseProtoMsg,
      parts: [
        {
          contentType: "image/jpeg",
          disposition: 2,
          source: { case: "url", value: "https://example.com/img.jpg" },
          filename: "",
        },
      ],
    } as any);
    expect(msg.parts[0].disposition).toBe(2);
  });

  it("maps url source in message part", () => {
    const msg = mapMessage({
      ...baseProtoMsg,
      parts: [
        {
          contentType: "image/jpeg",
          disposition: 0,
          source: { case: "url", value: "https://example.com/img.jpg" },
          filename: "img.jpg",
        },
      ],
    } as any);
    const urlPart = msg.parts[0];
    if (!("url" in urlPart)) {
      throw new Error("expected url part");
    }
    expect(urlPart.url).toBe("https://example.com/img.jpg");
    expect(urlPart.filename).toBe("img.jpg");
    expect("content" in urlPart).toBe(false);
  });

  it("maps deleteTime when present", () => {
    const msg = mapMessage({ ...baseProtoMsg, deleteTime: ts(999) } as any);
    expect(msg.deleteTime).toEqual(new Date(999_000));
  });

  it("returns empty Uint8Array when part source case is undefined", () => {
    const msg = mapMessage({
      ...baseProtoMsg,
      parts: [
        {
          contentType: "text/plain",
          disposition: 0,
          source: { case: undefined, value: undefined },
          filename: "",
        },
      ],
    } as any);
    const part = msg.parts[0];
    if (!("content" in part)) {
      throw new Error("expected content part");
    }
    expect(part.content).toBeInstanceOf(Uint8Array);
    expect(part.content).toHaveLength(0);
  });
});

// -------------------------
// mapMessageDelivery
// -------------------------

describe("mapMessageDelivery", () => {
  it("extracts messageId from resource name", () => {
    const del = mapMessageDelivery({
      message: "messages/msg1",
      account: protoAccount,
      status: 2,
      errorCode: "",
      errorMessage: "",
      statusChangeTime: ts(300),
    } as any);
    expect(del.messageId).toBe("msg1");
    expect(del.status).toBe(2);
    expect(del.statusChangeTime).toEqual(new Date(300_000));
  });

  it("normalizes empty errorCode and errorMessage to undefined", () => {
    const del = mapMessageDelivery({
      message: "messages/msg1",
      account: undefined,
      status: 2,
      errorCode: "",
      errorMessage: "",
      statusChangeTime: undefined,
    } as any);
    expect(del.errorCode).toBeUndefined();
    expect(del.errorMessage).toBeUndefined();
  });

  it("preserves non-empty errorCode and errorMessage", () => {
    const del = mapMessageDelivery({
      message: "messages/msg1",
      account: undefined,
      status: 5,
      errorCode: "ERR_UNDELIVERABLE",
      errorMessage: "Recipient not found",
      statusChangeTime: undefined,
    } as any);
    expect(del.errorCode).toBe("ERR_UNDELIVERABLE");
    expect(del.errorMessage).toBe("Recipient not found");
  });
});

// -------------------------
// mapReadReceipt
// -------------------------

describe("mapReadReceipt", () => {
  it("maps message ids list", () => {
    const rr = mapReadReceipt({
      account: protoAccount,
      messages: ["messages/m1", "messages/m2"],
      timestamp: ts(400),
    } as any);
    expect(rr.messageIds).toEqual(["m1", "m2"]);
    expect(rr.timestamp).toEqual(new Date(400_000));
  });
});

// -------------------------
// mapTypingIndicator
// -------------------------

describe("mapTypingIndicator", () => {
  it("maps typing field and contentType", () => {
    const ti = mapTypingIndicator({
      account: protoAccount,
      typing: true,
      timestamp: ts(500),
      contentType: "text/plain",
    } as any);
    expect(ti.typing).toBe(true);
    expect(ti.contentType).toBe("text/plain");
  });

  it("sets contentType to undefined when empty string", () => {
    const ti = mapTypingIndicator({
      account: protoAccount,
      typing: false,
      timestamp: undefined,
      contentType: "",
    } as any);
    expect(ti.contentType).toBeUndefined();
  });
});

// -------------------------
// mapDeliveryEvent
// -------------------------

const baseMsg = {
  name: "messages/msg1",
  account: undefined,
  recipient: "accounts/rec1",
  parts: [],
  metadata: {},
  direction: 1,
  createTime: undefined,
  deliverTime: undefined,
  replyTo: "",
  groupId: "",
  replaced: "",
  scope: 0,
  editNumber: BigInt(0),
  deleteTime: undefined,
} as any;

describe("mapDeliveryEvent", () => {
  const baseDeliveryProto = {
    connector: "connectors/conn1",
    deliveryId: "del-uuid-1",
    destination: "destinations/dest1",
    enqueueTime: ts(600),
  };

  it("maps message event with base fields", () => {
    const event = mapDeliveryEvent({
      ...baseDeliveryProto,
      event: { case: "message", value: baseMsg },
    } as any);
    expect(event.type).toBe("message");
    expect(event.connectorId).toBe("conn1");
    expect(event.deliveryId).toBe("del-uuid-1");
    expect(event.destinationId).toBe("dest1");
    expect(event.enqueueTime).toEqual(new Date(600_000));
    if (event.type === "message") {
      expect(event.message.id).toBe("msg1");
    }
  });

  it("maps deliveryUpdate event", () => {
    const event = mapDeliveryEvent({
      ...baseDeliveryProto,
      event: {
        case: "deliveryUpdate",
        value: {
          message: "messages/msg1",
          account: undefined,
          status: 2,
          errorCode: "",
          errorMessage: "",
          statusChangeTime: undefined,
        },
      },
    } as any);
    expect(event.type).toBe("deliveryUpdate");
    expect(event.deliveryId).toBe("del-uuid-1");
    expect(event.destinationId).toBe("dest1");
    if (event.type === "deliveryUpdate") {
      expect(event.deliveryUpdate.messageId).toBe("msg1");
    }
  });

  it("maps readReceipt event", () => {
    const event = mapDeliveryEvent({
      ...baseDeliveryProto,
      event: {
        case: "readReceipt",
        value: {
          account: undefined,
          messages: ["messages/m1"],
          timestamp: undefined,
        },
      },
    } as any);
    expect(event.type).toBe("readReceipt");
    if (event.type === "readReceipt") {
      expect(event.readReceipt.messageIds).toEqual(["m1"]);
    }
  });

  it("maps typingIndicator event", () => {
    const event = mapDeliveryEvent({
      ...baseDeliveryProto,
      event: {
        case: "typingIndicator",
        value: {
          account: undefined,
          typing: true,
          timestamp: undefined,
          contentType: "",
        },
      },
    } as any);
    expect(event.type).toBe("typingIndicator");
    if (event.type === "typingIndicator") {
      expect(event.typingIndicator.typing).toBe(true);
    }
  });

  it("maps unknown event case to type 'unknown'", () => {
    const event = mapDeliveryEvent({
      ...baseDeliveryProto,
      event: { case: undefined, value: undefined },
    } as any);
    expect(event.type).toBe("unknown");
    expect(event.connectorId).toBe("conn1");
    expect(event.deliveryId).toBe("del-uuid-1");
  });

  it("uses empty connectorId and destinationId when fields are empty", () => {
    const event = mapDeliveryEvent({
      connector: "",
      deliveryId: "",
      destination: "",
      enqueueTime: undefined,
      event: { case: undefined, value: undefined },
    } as any);
    expect(event.connectorId).toBe("");
    expect(event.destinationId).toBe("");
    expect(event.enqueueTime).toBeUndefined();
  });
});

// -------------------------
// mapDestination
// -------------------------

describe("mapDestination", () => {
  it("maps all fields", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "My Webhook",
      state: 1,
      eventTypes: [1, 2],
      filter: "",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
      createTime: ts(100),
      updateTime: ts(200),
    } as any);
    expect(dest.id).toBe("dest1");
    expect(dest.displayName).toBe("My Webhook");
    expect(dest.eventTypes).toEqual([1, 2]);
    expect(dest.createTime).toEqual(new Date(100_000));
  });

  it("normalizes empty displayName string to undefined", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "",
      state: 1,
      eventTypes: [],
      filter: "",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
    } as any);
    expect(dest.displayName).toBeUndefined();
  });

  it("preserves non-empty displayName string", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "My Webhook",
      state: 1,
      eventTypes: [],
      filter: "",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
    } as any);
    expect(dest.displayName).toBe("My Webhook");
  });

  it("normalizes empty filter string to undefined", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "",
      state: 1,
      eventTypes: [],
      filter: "",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
    } as any);
    expect(dest.filter).toBeUndefined();
  });

  it("preserves non-empty filter string", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "",
      state: 1,
      eventTypes: [],
      filter: "channel_type == 'whatsapp'",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
    } as any);
    expect(dest.filter).toBe("channel_type == 'whatsapp'");
  });

  it("maps lastTestTime and lastTestSuccess when lastTestTime is set", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "",
      state: 1,
      eventTypes: [],
      filter: "",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
      lastTestTime: ts(300),
      lastTestSuccess: true,
    } as any);
    expect(dest.lastTestTime).toEqual(new Date(300_000));
    expect(dest.lastTestSuccess).toBe(true);
  });

  it("sets lastTestTime and lastTestSuccess to undefined when lastTestTime is absent", () => {
    const dest = mapDestination({
      name: "destinations/dest1",
      displayName: "",
      state: 1,
      eventTypes: [],
      filter: "",
      payloadFormat: 1,
      target: { case: undefined, value: undefined },
      lastTestTime: undefined,
      lastTestSuccess: false,
    } as any);
    expect(dest.lastTestTime).toBeUndefined();
    expect(dest.lastTestSuccess).toBeUndefined();
  });
});
