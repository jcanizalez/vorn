import { Plus } from 'lucide-react'

interface Props {
  onAdd: () => void
}

export function AddStepNode({ onAdd }: Props) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onAdd() }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 hover:text-white
                 bg-white/[0.04] hover:bg-white/[0.08] border border-dashed border-white/[0.12]
                 hover:border-white/[0.25] rounded-lg transition-colors cursor-pointer"
    >
      <Plus size={13} />
      Add Step
    </button>
  )
}
