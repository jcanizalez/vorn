/**
 * Generic MCP (Model Context Protocol) connector.
 *
 * Where the github / linear connectors wrap a single upstream API, the MCP
 * connector is polymorphic: each connection points at some MCP server (any
 * stdio process — Filesystem, Azure DevOps, custom) and inherits that
 * server's tool surface dynamically via `tools/list`. Tool definitions are
 * stored on the connection row at discovery time (see `discoverTools`) so
 * the UI can render an invoke form without spawning the child each render.
 *
 * Auth model for the spike: static env vars. A non-secret `env` JSON object
 * is stored plaintext in `filters.env`, and a `secretEnv` JSON object is
 * encrypted through the same safeStorage path used by Linear's `apiKey`.
 * The decrypted values are merged in at spawn time via `getOrStartClient`.
 */
import type {
  VornConnector,
  ConnectorManifest,
  ConnectorActionDef,
  ConnectorConfigField,
  ActionResult,
  SourceConnection
} from '@vornrun/shared/types'
import { schemaProperties, schemaTypeHint, schemaRequired } from '@vornrun/shared/json-schema-utils'
import { getOrStartClient } from './mcp-clients'

/** Stable id for the generic MCP connector. Used everywhere the server
 *  needs to distinguish MCP from static connectors. */
export const MCP_CONNECTOR_ID = 'mcp'

export interface McpDiscoveredTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}

/**
 * Map an MCP tool's JSON-Schema `inputSchema` to the generic
 * `ConnectorActionDef` shape so the workflow editor can render tool args
 * with the same form it uses for every other connector. Types are coerced
 * back at execute time by `coerceMcpArgs` — here we pick input widgets.
 */
export function mcpToolToConnectorAction(tool: McpDiscoveredTool): ConnectorActionDef {
  const configFields: ConnectorConfigField[] = Object.entries(
    schemaProperties(tool.inputSchema)
  ).map(([key, raw]) => {
    const prop = raw as { description?: string; enum?: unknown[]; default?: unknown }
    const declaredType = schemaTypeHint(raw)
    const fieldBase = {
      key,
      label: key,
      required: schemaRequired(tool.inputSchema, key),
      ...(prop.description && { description: prop.description }),
      ...(prop.default !== undefined && { placeholder: JSON.stringify(prop.default) }),
      supportsTemplates: true
    }
    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      return {
        ...fieldBase,
        type: 'select' as const,
        options: prop.enum.map((v) => ({ value: String(v), label: String(v) }))
      }
    }
    // Non-scalar values live in a textarea and are JSON-parsed at execute time.
    if (declaredType === 'object' || declaredType === 'array') {
      return { ...fieldBase, type: 'textarea' as const, placeholder: '{} or []' }
    }
    return { ...fieldBase, type: 'text' as const }
  })
  return {
    type: tool.name,
    label: tool.name,
    ...(tool.description && { description: tool.description }),
    configFields,
    ...(tool.outputSchema && { outputSchema: tool.outputSchema })
  }
}

/**
 * Convert string form values back into the types the MCP tool expects,
 * using the stored inputSchema. Strings stay as strings; numeric/bool/
 * object/array fields are parsed. Invalid inputs pass through so the MCP
 * server's validator surfaces a meaningful error.
 */
function coerceMcpArgs(
  inputSchema: Record<string, unknown> | undefined,
  args: Record<string, unknown>
): Record<string, unknown> {
  if (!inputSchema) return args
  const properties = schemaProperties(inputSchema)
  if (Object.keys(properties).length === 0) return args
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    const t = schemaTypeHint(properties[key])
    if (typeof value !== 'string') {
      out[key] = value
      continue
    }
    // Empty-string + optional field → omit entirely so the MCP server can
    // fall back to its own default rather than rejecting `""` for a number.
    if (value === '') continue
    if (t === 'number' || t === 'integer') {
      const n = Number(value)
      out[key] = Number.isFinite(n) ? n : value
    } else if (t === 'boolean') {
      out[key] = value === 'true' ? true : value === 'false' ? false : value
    } else if (t === 'object' || t === 'array') {
      try {
        out[key] = JSON.parse(value)
      } catch {
        out[key] = value
      }
    } else {
      out[key] = value
    }
  }
  return out
}

/** Spawn the MCP server (if not already running) and run `tools/list`. */
export async function discoverTools(conn: SourceConnection): Promise<McpDiscoveredTool[]> {
  const client = await getOrStartClient(conn)
  const result = await client.listTools()
  return (result.tools ?? []).map((t) => {
    const tool = t as typeof t & { outputSchema?: Record<string, unknown> }
    return {
      name: tool.name,
      ...(tool.description && { description: tool.description }),
      ...(tool.inputSchema && { inputSchema: tool.inputSchema as Record<string, unknown> }),
      ...(tool.outputSchema && { outputSchema: tool.outputSchema })
    }
  })
}

/** Return the actions a given MCP connection exposes, in the same shape as
 *  any other connector's static manifest. Empty until discovery completes. */
export function mcpConnectionActions(conn: SourceConnection): ConnectorActionDef[] {
  const tools = conn.filters.discoveredTools
  if (!Array.isArray(tools)) return []
  return (tools as McpDiscoveredTool[]).map(mcpToolToConnectorAction)
}

/** Invoke a single MCP tool. Separate from `VornConnector.execute` because
 *  we need the `SourceConnection` itself to start/address the per-connection
 *  client, not just the merged args the generic execute path provides. */
export async function invokeMcpTool(
  conn: SourceConnection,
  toolName: string,
  args: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const client = await getOrStartClient(conn)
    // Look up this tool's discovered inputSchema so we can coerce string form
    // values back to the types the tool actually expects.
    const tools = conn.filters.discoveredTools
    const tool = Array.isArray(tools)
      ? (tools as McpDiscoveredTool[]).find((t) => t.name === toolName)
      : undefined
    const callArgs = coerceMcpArgs(tool?.inputSchema, args)
    const result = await client.callTool({ name: toolName, arguments: callArgs })
    // When the tool declared an outputSchema, MCP returns the typed payload
    // under `structuredContent`. Surface that as `output` so downstream
    // workflow steps can reference the declared fields directly
    // (`{{steps.x.fieldName}}`) without needing to drill through the
    // `structuredContent` wrapper. Tools without an outputSchema fall back
    // to the raw {content, isError} envelope.
    const structured = (result as { structuredContent?: Record<string, unknown> }).structuredContent
    const output = (structured ?? (result as unknown as Record<string, unknown>)) as Record<
      string,
      unknown
    >
    if (result.isError) {
      return {
        success: false,
        error: extractTextError(result.content) ?? `MCP tool ${toolName} reported an error`,
        output
      }
    }
    return { success: true, output }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function extractTextError(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined
  for (const block of content) {
    if (block && typeof block === 'object' && 'type' in block && block.type === 'text') {
      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }
  return undefined
}

export const mcpConnector: VornConnector = {
  id: 'mcp',
  name: 'MCP',
  icon: 'mcp',
  capabilities: ['actions'],

  describe(): ConnectorManifest {
    return {
      auth: [
        {
          key: 'command',
          label: 'Command',
          type: 'text',
          required: true,
          placeholder: 'npx',
          description: 'Executable to run the MCP server (npx, node, uv, python, …).'
        },
        {
          key: 'args',
          label: 'Arguments (JSON array)',
          type: 'textarea',
          required: true,
          placeholder: '["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]',
          description: 'JSON array of args passed to the command.'
        },
        {
          key: 'env',
          label: 'Environment (JSON object)',
          type: 'textarea',
          placeholder: '{"MCP_LOG_LEVEL": "info"}',
          description: 'Non-secret env vars. JSON object of string values.'
        },
        {
          key: 'secretEnv',
          label: 'Secret env (JSON object)',
          type: 'password',
          placeholder: '{"AZURE_DEVOPS_EXT_PAT": "<token>"}',
          description: 'Secret env vars encrypted via OS keychain. JSON object of string values.'
        }
      ],
      // Actions are per-connection (discovered via tools/list). The static
      // list stays empty; callers query `connection:listMcpTools` instead.
      actions: []
    }
  },

  /** VornConnector.execute is the generic entry point. The MCP execute path
   *  is routed through `invokeMcpTool` at the IPC layer because it needs the
   *  full SourceConnection to spawn/address the per-connection stdio client.
   *  This stub exists only so capabilities include 'actions'. */
  async execute(actionType: string): Promise<ActionResult> {
    return {
      success: false,
      error: `MCP actions must be invoked via connection:executeAction (tried ${actionType}).`
    }
  }
}
