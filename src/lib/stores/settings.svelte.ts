import { browser } from '$app/environment';
import type { NotificationMode, NotificationEventSettings } from '$lib/notifications/types';

const DEFAULT_AGENT_FIRST_MESSAGE = 'You are an agent named "{name}". Await further instructions.';

const DEFAULT_AGENT_WORKFLOW = `## MANDATORY Ticket Workflow

**FOR EACH TICKET**, follow this EXACT sequence:

1. **CLAIM** - Update ticket to \`in_progress\` BEFORE starting work:
   \`mcp__beads-agent__update_issue({ id: "<ticket-id>", status: "in_progress" })\`

2. **WORK** - Implement the changes

3. **COMMIT** - Create atomic commit with ticket reference:
   \`git add <files> && git commit -m "<type>(<ticket-id>): <description>"\`

4. **LINT** - Run linting and fix any issues BEFORE closing:
   \`bun run check\`
   - If errors: fix them, commit fixes, re-run lint
   - Only proceed to CLOSE when lint passes

5. **CLOSE** - Update ticket with summary, commit ID, and hash:
   \`\`\`
   git log -1 --format="%H %s"  # Get commit hash and message
   mcp__beads-agent__update_issue({
     id: "<ticket-id>",
     status: "closed",
     notes: "Summary: <what was done>\\nCommit: <hash> <message>"
   })
   \`\`\`

**NEVER**:
- Start work without claiming (updating to in_progress)
- Move to next ticket before committing current work
- Close ticket without running lint and ensuring it passes
- Close ticket without recording commit info`;

const DEFAULT_AGENT_TICKET_DELIVERY = `<assignment id="{id}" name="{name}">
<context>
You are assigned to ticket {id}.
</context>

<task>
<title>{title}</title>
<description>{description}</description>
<comments>{comments}</comments>
<attachments>{attachments}</attachments>
<dependencies>{dependencies}</dependencies>
<dependents>{dependents}</dependents>
</task>

<instructions>
Start by claiming the ticket (set status to in_progress), then implement the required changes.
</instructions>
</assignment>`;

const DEFAULT_AGENT_TICKET_NOTIFICATION = `<ticket_notification id="{id}" title="{title}">
<context>
Ticket update notification for {id}.
</context>

<message>
<sender>{sender}</sender>
<content>{content}</content>
</message>

<instructions>
Review the notification content and apply any required action to ticket {id}.
</instructions>
</ticket_notification>`;

function loadString(key: string, fallback: string): string {
	if (!browser) return fallback;
	return localStorage.getItem(key) ?? fallback;
}

function loadBool(key: string, fallback: boolean): boolean {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	if (v === null) return fallback;
	return v === 'true';
}

function loadNumber(key: string, fallback: number): number {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	if (v === null) return fallback;
	return Number(v);
}

function loadObject<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	if (v === null) return fallback;
	try {
		return JSON.parse(v) as T;
	} catch {
		return fallback;
	}
}

function persist(key: string, value: string) {
	if (browser) localStorage.setItem(key, value);
}

function createSettings() {
	// Theme
	let isDarkMode = $state(true);
	let colorScheme = $state('default');
	let notificationsEnabled = $state(false);

	// Notifications
	let notificationMode = $state<NotificationMode>('none');
	let notificationEvents = $state<NotificationEventSettings>({
		blocked: true,
		unblocked: true,
		status_changed: true,
		priority_changed: false,
		assignee_changed: true,
		comment_added: false,
		dependency_added: false,
		label_modified: false,
		attachment_added: false,
		issue_created: false,
		issue_closed: true
	});
	let mcpBatchDelay = $state(5000);

	// Agent
	let agentEnabled = $state(true);
	let agentHost = $state('localhost');
	let agentPort = $state(8765);
	let agentFirstMessage = $state(DEFAULT_AGENT_FIRST_MESSAGE);
	let agentSystemPrompt = $state('');
	let agentWorkflow = $state(DEFAULT_AGENT_WORKFLOW);
	let agentTicketDelivery = $state(DEFAULT_AGENT_TICKET_DELIVERY);
	let agentTicketNotification = $state(DEFAULT_AGENT_TICKET_NOTIFICATION);
	let agentToolsExpanded = $state(false);

	// Layout
	let collapsedColumns = $state<Set<string>>(new Set());

	const combinedSystemPrompt = $derived(
		[agentSystemPrompt, agentWorkflow].filter(Boolean).join('\n\n')
	);

	function load() {
		if (!browser) return;
		const saved = localStorage.getItem('theme');
		if (saved) {
			isDarkMode = saved === 'dark';
		} else {
			isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}
		const savedCollapsed = localStorage.getItem('collapsedColumns');
		if (savedCollapsed) collapsedColumns = new Set(JSON.parse(savedCollapsed));
		agentEnabled = loadBool('agentEnabled', agentEnabled);
		agentHost = loadString('agentHost', agentHost);
		agentPort = loadNumber('agentPort', agentPort);
		agentFirstMessage = loadString('agentFirstMessage', agentFirstMessage);
		agentSystemPrompt = loadString('agentSystemPrompt', agentSystemPrompt);
		agentWorkflow = loadString('agentWorkflow', agentWorkflow);
		agentTicketDelivery = loadString('agentTicketDelivery', agentTicketDelivery);
		agentTicketNotification = loadString('agentTicketNotification', agentTicketNotification);
		agentToolsExpanded = loadBool('agentToolsExpanded', agentToolsExpanded);
		colorScheme = loadString('colorScheme', colorScheme);
		notificationsEnabled = loadBool('notificationsEnabled', notificationsEnabled);
		notificationMode = loadString('notificationMode', notificationMode) as NotificationMode;
		notificationEvents = loadObject('notificationEvents', notificationEvents);
		mcpBatchDelay = loadNumber('mcpBatchDelay', mcpBatchDelay);
	}

	function toggleColumnCollapse(key: string) {
		const next = new Set(collapsedColumns);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		collapsedColumns = next;
		persist('collapsedColumns', JSON.stringify([...next]));
	}

	return {
		get isDarkMode() { return isDarkMode; },
		set isDarkMode(v: boolean) { isDarkMode = v; persist('theme', v ? 'dark' : 'light'); },
		get colorScheme() { return colorScheme; },
		set colorScheme(v: string) { colorScheme = v; persist('colorScheme', v); },
		get notificationsEnabled() { return notificationsEnabled; },
		set notificationsEnabled(v: boolean) { notificationsEnabled = v; persist('notificationsEnabled', String(v)); },
		get agentEnabled() { return agentEnabled; },
		set agentEnabled(v: boolean) { agentEnabled = v; persist('agentEnabled', String(v)); },
		get agentHost() { return agentHost; },
		set agentHost(v: string) { agentHost = v; persist('agentHost', v); },
		get agentPort() { return agentPort; },
		set agentPort(v: number) { agentPort = v; persist('agentPort', String(v)); },
		get agentFirstMessage() { return agentFirstMessage; },
		set agentFirstMessage(v: string) { agentFirstMessage = v; persist('agentFirstMessage', v); },
		get agentSystemPrompt() { return agentSystemPrompt; },
		set agentSystemPrompt(v: string) { agentSystemPrompt = v; persist('agentSystemPrompt', v); },
		get agentWorkflow() { return agentWorkflow; },
		set agentWorkflow(v: string) { agentWorkflow = v; persist('agentWorkflow', v); },
		get agentTicketDelivery() { return agentTicketDelivery; },
		set agentTicketDelivery(v: string) { agentTicketDelivery = v; persist('agentTicketDelivery', v); },
		get agentTicketNotification() { return agentTicketNotification; },
		set agentTicketNotification(v: string) { agentTicketNotification = v; persist('agentTicketNotification', v); },
		get agentToolsExpanded() { return agentToolsExpanded; },
		set agentToolsExpanded(v: boolean) { agentToolsExpanded = v; persist('agentToolsExpanded', String(v)); },
		get collapsedColumns() { return collapsedColumns; },
		get combinedSystemPrompt() { return combinedSystemPrompt; },
		get notificationMode() { return notificationMode; },
		set notificationMode(v: NotificationMode) { notificationMode = v; persist('notificationMode', v); },
		get notificationEvents() { return notificationEvents; },
		set notificationEvents(v: NotificationEventSettings) { notificationEvents = v; persist('notificationEvents', JSON.stringify(v)); },
		get mcpBatchDelay() { return mcpBatchDelay; },
		set mcpBatchDelay(v: number) { mcpBatchDelay = v; persist('mcpBatchDelay', String(v)); },
		load,
		toggleColumnCollapse,
	};
}

export const settings = createSettings();
