import { describe, expect, it } from "vitest";
import { OutboxClient } from "./index.js";
import { AccountsNamespace } from "./namespaces/accounts.js";
import { ConnectorsNamespace } from "./namespaces/connectors.js";
import { DestinationsNamespace } from "./namespaces/destinations.js";
import { MessagesNamespace } from "./namespaces/messages.js";
import { TemplatesNamespace } from "./namespaces/templates.js";

describe("OutboxClient", () => {
  it("creates an instance with all namespace properties as correct types", () => {
    const client = new OutboxClient({ apiKey: "ob_test_fake" });
    expect(client.accounts).toBeInstanceOf(AccountsNamespace);
    expect(client.connectors).toBeInstanceOf(ConnectorsNamespace);
    expect(client.destinations).toBeInstanceOf(DestinationsNamespace);
    expect(client.messages).toBeInstanceOf(MessagesNamespace);
    expect(client.templates).toBeInstanceOf(TemplatesNamespace);
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
