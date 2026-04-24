import type { VornConnector } from '@vornrun/shared/types'
import log from '../logger'

class ConnectorRegistry {
  private connectors = new Map<string, VornConnector>()

  register(connector: VornConnector): void {
    if (this.connectors.has(connector.id)) {
      log.warn(`Connector "${connector.id}" already registered, overwriting`)
    }
    this.connectors.set(connector.id, connector)
    log.info(`Registered connector: ${connector.id} (${connector.capabilities.join(', ')})`)
  }

  get(id: string): VornConnector | undefined {
    return this.connectors.get(id)
  }

  list(): VornConnector[] {
    return [...this.connectors.values()]
  }

  has(id: string): boolean {
    return this.connectors.has(id)
  }
}

export const connectorRegistry = new ConnectorRegistry()
