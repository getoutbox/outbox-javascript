# Required or Desired Server-Side Changes

This document tracks server-side changes that the SDK would benefit from.

## Desired: Support metadata updates in UpdateMessageRequest

**Proto:** `outbox.v1.UpdateMessageRequest`

**Current server behavior:** The proto comment states "Only parts may be updated; other fields are ignored." Sending a `metadata` field in the update request is silently dropped.

**Desired:** Allow updating `Message.metadata` via `UpdateMessageRequest`, with `metadata` as a valid field mask path.

**SDK impact:** `UpdateMessageInput` currently omits `metadata` to align with the server. Once the server supports it, restore the field:

```typescript
export interface UpdateMessageInput {
  id: string;
  metadata?: Record<string, string>; // restore when server supports it
  parts?: MessagePart[];
  requestId?: string;
}
```
