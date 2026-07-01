import type { Issue } from '$lib/types';

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

export const demoIssues: Issue[] = [
	{
		id: 'bk-0142',
		seq: 142,
		title: 'Login button silently fails after 2FA timeout',
		description:
			"When a session times out during the 2FA challenge, the login button stops responding without any visible error. Users assume the page is frozen and refresh, losing form state.\n\nReproduced on Safari 17 and Chrome 121. Likely related to the stale CSRF token after the auth boundary expires.",
		status: 'in_progress',
		priority: 0,
		issue_type: 'bug',
		created_at: ago(60 * 24 * 3),
		updated_at: ago(45),
		assignee: 'agent-claude-1',
		labels: ['auth', 'frontend', 'p0-this-week'],
		agent_model: 'sonnet',
		agent_effort: 'high',
		dependencies: [
			{ id: 'bk-0130', title: 'Refresh CSRF middleware', status: 'closed', dependency_type: 'blocks' }
		],
		dependents: [
			{ id: 'bk-0151', title: 'Add toast for auth failures', status: 'open', dependency_type: 'blocks' },
			{ id: 'bk-0153', title: 'Audit session timeouts', status: 'open', dependency_type: 'related' }
		],
		dependency_count: 1,
		dependent_count: 2,
		comments: [
			{
				id: '1',
				author: 'jurre',
				text: "Confirmed in the staging env. Same issue with the trial signup form.",
				created_at: ago(120)
			},
			{
				id: '2',
				author: 'agent-claude-1',
				text: "Located the stale-token branch in `auth/challenge.ts:142`. Patching now — will push a draft PR for review within the hour.",
				created_at: ago(48)
			}
		]
	},
	{
		id: 'bk-0138',
		seq: 138,
		title: 'Cannot save draft when offline',
		description:
			'Drafts disappear if the user loses connection mid-edit. Need a local persistence layer (IndexedDB) and a reconnect-merge strategy.',
		status: 'blocked',
		priority: 1,
		issue_type: 'bug',
		created_at: ago(60 * 24 * 5),
		updated_at: ago(60 * 24),
		assignee: 'jurre',
		labels: ['offline', 'data-loss'],
		dependencies: [
			{ id: 'bk-0119', title: 'Decide on offline strategy (Yjs vs custom)', status: 'open', dependency_type: 'blocks' },
			{ id: 'bk-0125', title: 'Storage budget audit', status: 'in_progress', dependency_type: 'blocks' }
		],
		dependency_count: 2,
		dependent_count: 0,
		comments: []
	},
	{
		id: 'bk-0145',
		seq: 145,
		title: 'Add CSV export to reports',
		description: 'Users have asked for a flat CSV export of the reports view, mirroring the visible columns.',
		status: 'open',
		priority: 2,
		issue_type: 'feature',
		created_at: ago(60 * 12),
		updated_at: ago(60 * 12),
		labels: ['reports'],
		comments: []
	},
	{
		id: 'bk-0150',
		seq: 150,
		title: 'Refactor the column accent system',
		description:
			'The status accent color is hardcoded in three places. Extract to a single source of truth so column theming is configurable.',
		status: 'hooked',
		priority: 2,
		issue_type: 'chore',
		created_at: ago(60 * 24 * 2),
		updated_at: ago(60 * 6),
		assignee: 'agent-claude-2',
		labels: ['tech-debt', 'theming'],
		agent_model: 'haiku',
		comments: []
	},
	{
		id: 'bk-0124',
		seq: 124,
		title: 'Onboarding flow checkpoint',
		description: 'Three-step onboarding for new workspaces. Track sub-tasks here.',
		status: 'open',
		priority: 1,
		issue_type: 'epic',
		created_at: ago(60 * 24 * 7),
		updated_at: ago(60 * 24),
		labels: ['onboarding', 'q2-goal'],
		dependent_count: 6,
		comments: []
	},
	{
		id: 'bk-0102',
		seq: 102,
		title: 'Avatar uploads return 500 for large PNGs',
		description: 'Fixed in 1.4.2. Patched the multipart parser to handle files >5 MB and added a backpressure test.',
		status: 'closed',
		priority: 1,
		issue_type: 'bug',
		created_at: ago(60 * 24 * 14),
		updated_at: ago(60 * 24 * 2),
		closed_at: ago(60 * 24 * 2),
		assignee: 'agent-claude-3',
		labels: ['uploads'],
		notes:
			'Multipart parser was buffering the entire file in memory. Swapped to a streaming parser and added a 25 MB hard cap with a clear error. Backfilled tests for 1 MB / 6 MB / 25 MB / 26 MB.',
		comments: []
	}
];

export const pinnedIds = new Set(['bk-0142']);
export const worktreeIds = new Set(['bk-0142']);
export const impactScores: Record<string, number> = {
	'bk-0142': 82,
	'bk-0124': 54,
	'bk-0138': 48
};
export const externallyClosedIds = new Set<string>();
