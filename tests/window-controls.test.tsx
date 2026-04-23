// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const windowMinimize = vi.fn()
const windowMaximize = vi.fn()
const windowClose = vi.fn()

Object.defineProperty(window, 'api', {
  value: {
    windowMinimize,
    windowMaximize,
    windowClose,
    getAppVersion: () => 'test',
    detectIDEs: vi.fn().mockResolvedValue([])
  },
  writable: true
})

// Force non-Mac + non-Web so WindowControls renders
vi.mock('../src/renderer/lib/platform', () => ({
  isMac: false,
  isWeb: false
}))

import { WindowControls } from '../src/renderer/components/WindowControls'

beforeEach(() => {
  windowMinimize.mockClear()
  windowMaximize.mockClear()
  windowClose.mockClear()
})

describe('WindowControls', () => {
  it('renders minimize, maximize, and close buttons', () => {
    render(<WindowControls />)
    expect(screen.getByRole('button', { name: 'Minimize' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Maximize' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('calls window.api.windowMinimize on minimize click', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(windowMinimize).toHaveBeenCalledTimes(1)
  })

  it('calls window.api.windowMaximize on maximize click', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    expect(windowMaximize).toHaveBeenCalledTimes(1)
  })

  it('calls window.api.windowClose on close click', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(windowClose).toHaveBeenCalledTimes(1)
  })
})
