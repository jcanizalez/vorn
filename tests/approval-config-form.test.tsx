// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ApprovalConfigForm } from '../src/renderer/components/workflow-editor/panels/ApprovalConfigForm'
import type { ApprovalConfig } from '../src/shared/types'

describe('ApprovalConfigForm', () => {
  it('renders message textarea and timeout input', () => {
    const { container } = render(<ApprovalConfigForm config={{}} onChange={vi.fn()} />)
    expect(container.querySelector('textarea')).toBeTruthy()
    expect(container.querySelector('input[type="number"]')).toBeTruthy()
    expect(container.textContent).toContain('Message')
    expect(container.textContent).toContain('Timeout')
  })

  it('invokes onChange with new message text', () => {
    const onChange = vi.fn()
    const { container } = render(<ApprovalConfigForm config={{}} onChange={onChange} />)
    const textarea = container.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: 'Please review' } })
    expect(onChange).toHaveBeenCalledWith({ message: 'Please review' })
  })

  it('converts seconds input to timeoutMs on change', () => {
    const onChange = vi.fn()
    const { container } = render(<ApprovalConfigForm config={{}} onChange={onChange} />)
    const input = container.querySelector('input[type="number"]')!
    fireEvent.change(input, { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith({ timeoutMs: 30000 })
  })

  it('clears timeoutMs when input is emptied', () => {
    const onChange = vi.fn()
    const config: ApprovalConfig = { timeoutMs: 5000 }
    const { container } = render(<ApprovalConfigForm config={config} onChange={onChange} />)
    const input = container.querySelector('input[type="number"]')!
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ timeoutMs: undefined })
  })

  it('displays existing timeout converted to seconds', () => {
    const config: ApprovalConfig = { timeoutMs: 60000 }
    const { container } = render(<ApprovalConfigForm config={config} onChange={vi.fn()} />)
    const input = container.querySelector('input[type="number"]') as HTMLInputElement
    expect(input.value).toBe('60')
  })

  it('rejects zero/negative timeout input', () => {
    const onChange = vi.fn()
    const { container } = render(<ApprovalConfigForm config={{}} onChange={onChange} />)
    const input = container.querySelector('input[type="number"]')!
    fireEvent.change(input, { target: { value: '0' } })
    expect(onChange).toHaveBeenCalledWith({ timeoutMs: undefined })
  })
})
