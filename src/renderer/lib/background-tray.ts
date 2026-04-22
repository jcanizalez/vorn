import type {
  HeadlessSession,
  WorkflowExecution,
  NodeExecutionState,
  WorkflowDefinition
} from '../../shared/types'

export interface WaitingApproval {
  execution: WorkflowExecution
  nodeState: NodeExecutionState
  workflow?: WorkflowDefinition
}

export function backgroundTrayHasItems(
  headlessSessions: HeadlessSession[],
  minimizedIds: string[],
  waitingApprovals: WaitingApproval[]
): boolean {
  return headlessSessions.length + minimizedIds.length + waitingApprovals.length > 0
}
