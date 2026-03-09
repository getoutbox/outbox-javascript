import { describe, expect, it } from "vitest";
import { OutboxClient } from "./index.js";
import { AccountsNamespace } from "./namespaces/accounts.js";
import { ChannelsNamespace } from "./namespaces/channels.js";
import { ConnectorsNamespace } from "./namespaces/connectors.js";
import { DestinationsNamespace } from "./namespaces/destinations.js";
import { MessagesNamespace } from "./namespaces/messages.js";

describe("OutboxClient", () => {
  it("creates an instance with all 5 namespace properties as correct types", () => {
    const client = new OutboxClient({ apiKey: "ob_test_fake" });
    expect(client.accounts).toBeInstanceOf(AccountsNamespace);
    expect(client.channels).toBeInstanceOf(ChannelsNamespace);
    expect(client.connectors).toBeInstanceOf(ConnectorsNamespace);
    expect(client.destinations).toBeInstanceOf(DestinationsNamespace);
    expect(client.messages).toBeInstanceOf(MessagesNamespace);
  });

  it("constructs without throwing with default and custom baseUrl", () => {
    expect(() => new OutboxClient({ apiKey: "ob_test_fake" })).not.toThrow();
    expect(
      () =>
        new OutboxClient({
          apiKey: "ob_test_fake",
          baseUrl: "https://localhost:8080",
        })
    ).not.toThrow();
  });
});
