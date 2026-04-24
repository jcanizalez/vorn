/**
 * Tiny helpers for poking at the JSON Schema shapes we store on connector
 * actions (input/output schemas, MCP tool definitions). Shared between
 * server and renderer so a change to the shape-assumptions lands in one
 * place instead of four.
 */

/** Extract the `properties` map from a JSON Schema, or `{}` if absent or
 *  not an object. Tolerates the non-object root case (a schema with `type:
 *  'string'` at the top level, for example). */
export function schemaProperties(
  schema: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {}
  const props = (schema as { properties?: Record<string, unknown> }).properties
  if (!props || typeof props !== 'object') return {}
  return props
}

/** Normalize a schema property's `type` field. JSON Schema allows either
 *  a string or an array of strings (for nullable/union types); we pick the
 *  first non-null entry so the caller can switch on a single value. */
export function schemaTypeHint(prop: unknown): string | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const t = (prop as { type?: string | string[] }).type
  if (Array.isArray(t)) return t.find((x) => x !== 'null') ?? t[0]
  return t
}

/** True if the schema declares `required: [...]` containing `key`. */
export function schemaRequired(schema: Record<string, unknown> | undefined, key: string): boolean {
  if (!schema || typeof schema !== 'object') return false
  const req = (schema as { required?: unknown }).required
  return Array.isArray(req) && req.includes(key)
}
