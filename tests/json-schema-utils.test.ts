import { describe, it, expect } from 'vitest'
import {
  schemaProperties,
  schemaTypeHint,
  schemaRequired
} from '../packages/shared/src/json-schema-utils'

describe('schemaProperties', () => {
  it('returns the properties map for an object schema', () => {
    const props = schemaProperties({ type: 'object', properties: { a: { type: 'string' } } })
    expect(props).toEqual({ a: { type: 'string' } })
  })

  it('returns {} for a schema without properties', () => {
    expect(schemaProperties({ type: 'string' })).toEqual({})
  })

  it('returns {} for undefined or non-object input', () => {
    expect(schemaProperties(undefined)).toEqual({})
    // @ts-expect-error — runtime tolerance
    expect(schemaProperties(null)).toEqual({})
  })
})

describe('schemaTypeHint', () => {
  it('returns a scalar type string', () => {
    expect(schemaTypeHint({ type: 'string' })).toBe('string')
    expect(schemaTypeHint({ type: 'number' })).toBe('number')
  })

  it('picks the first non-null entry from a union type', () => {
    expect(schemaTypeHint({ type: ['null', 'string'] })).toBe('string')
    expect(schemaTypeHint({ type: ['string', 'number'] })).toBe('string')
  })

  it('returns undefined for missing or malformed input', () => {
    expect(schemaTypeHint({})).toBeUndefined()
    expect(schemaTypeHint(undefined)).toBeUndefined()
    expect(schemaTypeHint('not-an-object')).toBeUndefined()
  })
})

describe('schemaRequired', () => {
  it('returns true when the key is in the required array', () => {
    expect(schemaRequired({ required: ['a', 'b'] }, 'a')).toBe(true)
    expect(schemaRequired({ required: ['a', 'b'] }, 'b')).toBe(true)
  })

  it('returns false when the key is absent or required is missing', () => {
    expect(schemaRequired({ required: ['a'] }, 'b')).toBe(false)
    expect(schemaRequired({}, 'a')).toBe(false)
    expect(schemaRequired(undefined, 'a')).toBe(false)
  })
})
