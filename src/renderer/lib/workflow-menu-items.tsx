import { type ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { ICON_MAP } from '../components/project-sidebar/icon-map'
import { executeWorkflow } from './workflow-execution'
import type { WorkflowDefinition } from '../../shared/types'

export interface WorkflowMenuItem {
  id: string
  iconElement: ReactNode
  label: string
  detail?: string
  onClick: () => void
  separator?: boolean
  isHeader?: boolean
}

export function buildWorkflowMenuItems(
  workflows: WorkflowDefinition[],
  onSelect: () => void
): WorkflowMenuItem[] {
  return workflows.map((wf) => {
    const WfIcon = ICON_MAP[wf.icon] || Zap
    return {
      id: wf.id,
      iconElement: <WfIcon size={12} color={wf.iconColor} />,
      label: wf.name,
      onClick: () => {
        onSelect()
        executeWorkflow(wf, undefined, { source: 'manual' })
      }
    }
  })
}
