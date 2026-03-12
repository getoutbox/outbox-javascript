// Construction
export const connectorName = (id: string) => `connectors/${id}`;
export const destinationName = (id: string) => `destinations/${id}`;
export const messageName = (id: string) => `messages/${id}`;
export const accountName = (id: string) => `accounts/${id}`;
export const templateName = (connectorId: string, templateId: string) =>
  `connectors/${connectorId}/templates/${templateId}`;
export const templateParent = (connectorId: string) =>
  `connectors/${connectorId}`;

// Parsing — extract the last segment from a resource name
// e.g. "messages/abc" → "abc", "accounts/xyz" → "xyz"
export const parseId = (name: string): string => {
  const id = name.split("/").pop();
  if (!id) {
    throw new Error(`Invalid resource name: "${name}"`);
  }
  return id;
};
