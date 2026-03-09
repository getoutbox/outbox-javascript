const SKIP = new Set(["id", "requestId"]);

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Derives a FieldMask `paths` array from the keys of `input`, skipping
 * ID/structural fields and any key whose value is `undefined`.
 */
export function deriveFieldMask(input: Record<string, unknown>): {
  paths: string[];
} {
  return {
    paths: Object.keys(input)
      .filter((k) => !SKIP.has(k) && input[k] !== undefined)
      .map(camelToSnake),
  };
}
