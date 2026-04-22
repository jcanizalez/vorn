import { useShallow } from 'zustand/react/shallow'
import {
  HeadlessSession,
  WorkflowExecution,
  NodeExecutionState,
  WorkflowDefinition
} from '../../shared/types'
import { HeadlessPill } from './HeadlessPill'
import { MinimizedPill } from './MinimizedPill'
import { WaitingApprovalPill } from './WaitingApprovalPill'
import { useAppStore } from '../stores'
import { ChevronRight } from 'lucide-react'

export interface WaitingApproval {
  execution: WorkflowExecution
  nodeState: NodeExecutionState
  workflow?: WorkflowDefinition
}

interface Props {
  headlessSessions: HeadlessSession[]
  minimizedIds: string[]
  waitingApprovals: WaitingApproval[]
  variant: 'grid' | 'tabs'
  hasItemsBelow?: boolean
}

export function BackgroundTray({
  headlessSessions,
  minimizedIds,
  waitingApprovals,
  variant,
  hasItemsBelow
}: Props) {
  const { collapsed, toggle } = useAppStore(
    useShallow((s) => ({
      collapsed: s.backgroundTrayCollapsed,
      toggle: s.toggleBackgroundTray
    }))
  )

  const headlessCount = headlessSessions.length
  const minimizedCount = minimizedIds.length
  const waitingCount = waitingApprovals.length
  const totalCount = headlessCount + minimizedCount + waitingCount

  if (totalCount === 0) return null

  const runningCount = headlessSessions.filter((s) => s.status === 'running').length
  const groupCount = [headlessCount, minimizedCount, waitingCount].filter((n) => n > 0).length
  const hasMultipleGroups = groupCount > 1

  const isGrid = variant === 'grid'

  return (
    <div className={isGrid ? 'mb-4' : 'shrink-0 px-3 py-2 border-b border-white/[0.06]'}>
      <button
        type="button"
        className={`flex items-center gap-1.5 w-full text-left cursor-pointer group ${isGrid ? 'px-1 mb-2' : 'mb-1.5'}`}
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label="Toggle background tray"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`text-gray-500 transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
        />
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Background
        </span>

        <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
          {waitingCount > 0 && (
            <span className="text-amber-400/80">
              {waitingCount} waiting approval{waitingCount === 1 ? '' : 's'}
            </span>
          )}
          {waitingCount > 0 && (headlessCount > 0 || minimizedCount > 0) && <span>&middot;</span>}
          {headlessCount > 0 && (
            <span>
              {runningCount > 0 ? `${runningCount} running` : `${headlessCount} headless`}
            </span>
          )}
          {headlessCount > 0 && minimizedCount > 0 && <span>&middot;</span>}
          {minimizedCount > 0 && <span>{minimizedCount} minimized</span>}
        </div>
      </button>

      {!collapsed && (
        <div className={`flex max-h-[120px] overflow-y-auto ${hasMultipleGroups ? 'gap-4' : ''}`}>
          {waitingCount > 0 && (
            <div className={hasMultipleGroups ? 'flex-1 min-w-0' : 'w-full'}>
              {hasMultipleGroups && (
                <span className="text-[9px] font-medium text-amber-400/70 uppercase tracking-wider mb-1 block">
                  waiting approval
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {waitingApprovals.map((w) => (
                  <WaitingApprovalPill
                    key={`${w.execution.workflowId}-${w.execution.startedAt}-${w.nodeState.nodeId}`}
                    execution={w.execution}
                    nodeState={w.nodeState}
                    workflow={w.workflow}
                  />
                ))}
              </div>
            </div>
          )}

          {waitingCount > 0 && (headlessCount > 0 || minimizedCount > 0) && (
            <div className="w-px bg-white/[0.08] self-stretch" />
          )}

          {headlessCount > 0 && (
            <div className={hasMultipleGroups ? 'flex-1 min-w-0' : 'w-full'}>
              {hasMultipleGroups && (
                <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider mb-1 block">
                  headless
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {headlessSessions.map((session) => (
                  <HeadlessPill key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {headlessCount > 0 && minimizedCount > 0 && (
            <div className="w-px bg-white/[0.08] self-stretch" />
          )}

          {minimizedCount > 0 && (
            <div className={hasMultipleGroups ? 'flex-1 min-w-0' : 'w-full'}>
              {hasMultipleGroups && (
                <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider mb-1 block">
                  minimized
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {minimizedIds.map((id) => (
                  <MinimizedPill key={id} terminalId={id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasItemsBelow && !collapsed && <div className="h-px bg-white/[0.06] mt-4" />}
    </div>
  )
}
