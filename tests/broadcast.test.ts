import { describe, it, expect, vi } from 'vitest'

vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { ClientRegistry } from '../packages/server/src/broadcast'

function mockWs(open = true) {
  const ws = {
    readyState: open ? 1 : 3,
    OPEN: 1,
    send: vi.fn()
  }
  return ws as unknown as import('ws').WebSocket
}

describe('ClientRegistry', () => {
  it('add increases size', () => {
    const reg = new ClientRegistry()
    reg.add(mockWs())
    expect(reg.size).toBe(1)
  })

  it('remove decreases size', () => {
    const reg = new ClientRegistry()
    const ws = mockWs()
    reg.add(ws)
    reg.remove(ws)
    expect(reg.size).toBe(0)
  })

  it('broadcast sends JSON to all open clients', () => {
    const reg = new ClientRegistry()
    const ws1 = mockWs()
    const ws2 = mockWs()
    reg.add(ws1)
    reg.add(ws2)
    reg.broadcast('test:event', { data: 1 })
    expect(ws1.send).toHaveBeenCalledOnce()
    expect(ws2.send).toHaveBeenCalledOnce()
    const sent = JSON.parse((ws1.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(sent.method).toBe('test:event')
    expect(sent.params).toEqual({ data: 1 })
  })

  it('broadcast skips closed clients', () => {
    const reg = new ClientRegistry()
    const open = mockWs(true)
    const closed = mockWs(false)
    reg.add(open)
    reg.add(closed)
    reg.broadcast('test:event', {})
    expect(open.send).toHaveBeenCalledOnce()
    expect(closed.send).not.toHaveBeenCalled()
  })

  it('broadcast on empty registry does nothing', () => {
    const reg = new ClientRegistry()
    expect(() => reg.broadcast('test:event', {})).not.toThrow()
  })
})
