import { describe, it, expect } from 'vitest'
import {
  createRequest,
  createNotification,
  createResponse,
  createErrorResponse
} from '@vibegrid/shared/protocol'

describe('JSON-RPC protocol helpers', () => {
  describe('createRequest', () => {
    it('creates a valid JSON-RPC request', () => {
      const req = createRequest(1, 'terminal:create' as never, { agentType: 'claude' } as never)
      expect(req).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'terminal:create',
        params: { agentType: 'claude' }
      })
    })

    it('handles void params', () => {
      const req = createRequest(2, 'config:load' as never, undefined as never)
      expect(req.jsonrpc).toBe('2.0')
      expect(req.id).toBe(2)
      expect(req.method).toBe('config:load')
    })
  })

  describe('createNotification', () => {
    it('creates a JSON-RPC notification (no id)', () => {
      const notif = createNotification('terminal:data', { id: 'abc', data: 'hello' })
      expect(notif).toEqual({
        jsonrpc: '2.0',
        method: 'terminal:data',
        params: { id: 'abc', data: 'hello' }
      })
      expect('id' in notif).toBe(false)
    })

    it('works without params', () => {
      const notif = createNotification('some:event')
      expect(notif.method).toBe('some:event')
      expect(notif.params).toBeUndefined()
    })
  })

  describe('createResponse', () => {
    it('creates a success response', () => {
      const res = createResponse(1, { id: 'session-123', pid: 456 })
      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { id: 'session-123', pid: 456 }
      })
    })

    it('handles null result', () => {
      const res = createResponse(5, null)
      expect(res.result).toBeNull()
      expect(res.error).toBeUndefined()
    })
  })

  describe('createErrorResponse', () => {
    it('creates an error response', () => {
      const res = createErrorResponse(3, -32601, 'Method not found')
      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 3,
        error: { code: -32601, message: 'Method not found' }
      })
      expect(res.result).toBeUndefined()
    })

    it('includes optional data', () => {
      const res = createErrorResponse(4, -32000, 'Server error', { detail: 'crash' })
      expect(res.error?.data).toEqual({ detail: 'crash' })
    })
  })
})
