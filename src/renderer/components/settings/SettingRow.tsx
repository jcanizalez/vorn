import { ReactNode } from 'react'

export function SettingRow({
  label,
  description,
  children,
  disabled
}: {
  label: string
  description: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-4 border-b border-white/[0.06] ${disabled ? 'opacity-40' : ''}`}
    >
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      {children}
    </div>
  )
}
