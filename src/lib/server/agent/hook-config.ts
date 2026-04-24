export type HookEventName =
  | 'TicketCreated'
  | 'TicketClosed'
  | 'StatusChanged'
  | 'PriorityChanged'
  | 'CommentAdded'
  | 'DependencyAdded'
  | 'AssigneeChanged'
  | 'LabelModified'
  | 'TicketBlocked'
  | 'TicketUnblocked'
  | 'AgentStarted'
  | 'AgentCompleted'
  | 'AgentError';

export type HookEntry = {
  command: string;
  matcher?: string;
  timeout?: number;
};

export type HookConfig = Partial<Record<HookEventName, HookEntry[]>>;

export type HookContext = {
  id?: string;
  title?: string;
  status?: string;
  priority?: number | string;
  assignee?: string;
  cwd?: string;
  oldStatus?: string;
  newStatus?: string;
  content?: string;
  sender?: string;
  agentName?: string;
  ticketId?: string;
  worktreePath?: string;
  error?: string;
};
