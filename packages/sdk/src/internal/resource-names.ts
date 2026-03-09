// Construction
export const channelName = (id: string) => `channels/${id}`;
export const connectorName = (id: string) => `connectors/${id}`;
export const destinationName = (id: string) => `destinations/${id}`;
export const messageName = (id: string) => `messages/${id}`;
export const accountName = (id: string) => `accounts/${id}`;

// Parsing — extract the last segment from a resource name
// e.g. "messages/abc" → "abc", "accounts/xyz" → "xyz"
export const parseId = (name: string): string => {
  const id = name.split("/").pop();
  if (!id) {
    throw new Error(`Invalid resource name: "${name}"`);
  }
  return id;
};
