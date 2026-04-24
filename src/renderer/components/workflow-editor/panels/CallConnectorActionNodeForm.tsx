import { useEffect, useState } from 'react'
import type {
  CallConnectorActionConfig,
  SourceConnection,
  ConnectorManifest,
  ConnectorActionDef
} from '../../../../shared/types'
import { SelectPicker } from '../../SelectPicker'
import { ConnectorIcon } from '../../ConnectorIcon'

interface Props {
  config: CallConnectorActionConfig
  onChange: (config: CallConnectorActionConfig) => void
}

interface ConnectorInfo {
  id: string
  name: string
  icon: string
  capabilities: string[]
  manifest: ConnectorManifest
}

export function CallConnectorActionNodeForm({ config, onChange }: Props) {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([])
  const [connections, setConnections] = useState<SourceConnection[]>([])

  useEffect(() => {
    window.api.listConnectors().then(setConnectors)
    window.api.listConnections().then(setConnections)
  }, [])

  const selectedConn = connections.find((c) => c.id === config.connectionId)
  const selectedConnector = selectedConn
    ? connectors.find((c) => c.id === selectedConn.connectorId)
    : undefined
  const selectedAction: ConnectorActionDef | undefined = selectedConnector?.manifest.actions?.find(
    (a) => a.type === config.action
  )

  // Non-auth config fields for the selected action — these become the args form.
  const argFields = selectedAction?.configFields ?? []

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Connection</label>
        <SelectPicker
          value={config.connectionId}
          options={connections.map((c) => ({
            value: c.id,
            label: c.name,
            icon: <ConnectorIcon connectorId={c.connectorId} size={14} className="text-gray-400" />
          }))}
          onChange={(v) => onChange({ ...config, connectionId: v, action: '', args: {} })}
          variant="form"
          placeholder="Select a connection..."
        />
        {connections.length === 0 && (
          <p className="text-[11px] text-gray-500 mt-1.5">
            No connections yet. Add one from Settings › Connectors first.
          </p>
        )}
      </div>

      {selectedConnector && (
        <div>
          <label className="text-[13px] text-gray-400 font-medium block mb-2">Action</label>
          <SelectPicker
            value={config.action}
            options={(selectedConnector.manifest.actions ?? []).map((a) => ({
              value: a.type,
              label: a.label
            }))}
            onChange={(v) => onChange({ ...config, action: v, args: {} })}
            variant="form"
            placeholder="Select an action..."
          />
          {selectedAction?.description && (
            <p className="text-[11px] text-gray-500 mt-1.5">{selectedAction.description}</p>
          )}
        </div>
      )}

      {argFields.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider">
            Arguments{' '}
            <span className="normal-case tracking-normal text-gray-600">
              · supports {`{{task.title}}`}, {`{{connectorItem.externalId}}`}
            </span>
          </div>
          {argFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-500 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={config.args?.[field.key] ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      args: { ...config.args, [field.key]: e.target.value }
                    })
                  }
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-sm
                             text-white placeholder:text-gray-600 focus:outline-none focus:border-white/[0.2] font-mono"
                />
              ) : (
                <input
                  type="text"
                  value={config.args?.[field.key] ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      args: { ...config.args, [field.key]: e.target.value }
                    })
                  }
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-sm
                             text-white placeholder:text-gray-600 focus:outline-none focus:border-white/[0.2] font-mono"
                />
              )}
              {field.description && (
                <p className="text-[10px] text-gray-600 mt-0.5">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
