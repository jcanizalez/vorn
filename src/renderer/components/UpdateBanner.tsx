import { useAppStore } from '../stores'
import { Download, X } from 'lucide-react'

export function UpdateBanner() {
  const version = useAppStore((s) => s.updateVersion)
  const setUpdateVersion = useAppStore((s) => s.setUpdateVersion)

  if (!version) return null

  return (
    <div
      className="mx-4 mt-4 px-4 py-3 border border-white/[0.08] bg-white/[0.03]
                    rounded-lg flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <Download size={16} className="text-gray-400 shrink-0" />
        <p className="text-sm text-gray-300">Update v{version} is ready. Restart to apply.</p>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <button
          onClick={() => window.api.installUpdate()}
          className="px-3 py-1 text-xs font-medium text-black rounded-md transition-colors bg-bronzo hover:bg-bronzo-dark"
        >
          Restart Now
        </button>
        <button
          onClick={() => setUpdateVersion(null)}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          title="Later"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
