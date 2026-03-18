/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertTriangle, Info } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Toast store — lightweight, no Zustand dependency                  */
/* ------------------------------------------------------------------ */

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

let listeners: Array<(toasts: Toast[]) => void> = []
let toasts: Toast[] = []

function notify() {
  listeners.forEach((fn) => fn([...toasts]))
}

export function toast(message: string, type: ToastType = 'success', duration = 2500) {
  const id = crypto.randomUUID()
  toasts = [...toasts, { id, message, type, duration }]
  notify()

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, duration)
}

toast.success = (msg: string) => toast(msg, 'success')
toast.error = (msg: string) => toast(msg, 'error', 4000)
toast.warning = (msg: string) => toast(msg, 'warning', 3500)
toast.info = (msg: string) => toast(msg, 'info')

/* ------------------------------------------------------------------ */
/*  Icons & colors per type                                           */
/* ------------------------------------------------------------------ */

const TOAST_STYLES: Record<
  ToastType,
  { icon: typeof Check; bg: string; border: string; text: string }
> = {
  success: {
    icon: Check,
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-400'
  },
  error: {
    icon: X,
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400'
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400'
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400'
  }
}

/* ------------------------------------------------------------------ */
/*  Toast container — rendered once in App.tsx                        */
/* ------------------------------------------------------------------ */

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([])

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      listeners = listeners.filter((l) => l !== setItems)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, [])

  return (
    <div
      className="fixed z-[200] flex flex-col gap-2 pointer-events-none"
      style={{
        bottom: 'calc(1.25rem + var(--safe-bottom, 0px) + var(--keyboard-height, 0px))',
        right: 'calc(1.25rem + var(--safe-right, 0px))'
      }}
    >
      <AnimatePresence mode="popLayout">
        {items.map((t) => {
          const style = TOAST_STYLES[t.type]
          const Icon = style.icon
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-lg border
                         shadow-xl backdrop-blur-sm min-w-[200px] max-w-[360px]
                         ${style.bg} ${style.border}`}
              style={{ background: 'rgba(26, 26, 30, 0.92)' }}
            >
              <Icon size={15} strokeWidth={2.5} className={`shrink-0 ${style.text}`} />
              <span className="text-sm text-gray-200 flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
