import type { MutationEntry } from './types';

let mutations = $state<MutationEntry[]>([]);
let loading = $state(false);

export async function fetchMutations(limit = 100): Promise<void> {
	if (loading) return;
	loading = true;
	try {
		const res = await fetch(`/api/events?limit=${limit}`);
		if (res.ok) {
			const data = await res.json();
			mutations = data.events;
		}
	} finally {
		loading = false;
	}
}

export function getMutations(): MutationEntry[] {
	return mutations;
}

export function clearMutations() {
	mutations = [];
}

export function formatMutation(m: MutationEntry): string {
	const id = `#${m.ticketId.slice(-6)}`;

	switch (m.mutationType) {
		case 'created':
			return `${id} created`;
		case 'closed':
			return `${id} closed`;
		case 'status':
			return `${id} ${m.previousValue} → ${m.newValue}`;
		case 'priority':
			return `${id} priority: ${m.previousValue} → ${m.newValue}`;
		case 'assignee':
			return `${id} assigned to ${m.newValue}`;
		case 'comment':
			return `${id} new comment`;
		case 'dependency': {
			const val = m.newValue || '';
			if (val.startsWith('+')) return `${id} → #${val.slice(-6)}`;
			if (val.startsWith('-')) return `${id} ✕ #${val.slice(-6)}`;
			return `${id} deps changed`;
		}
		case 'label': {
			const val = m.newValue || '';
			if (val.startsWith('+')) return `${id} labeled [${val.slice(1)}]`;
			if (val.startsWith('-')) return `${id} unlabeled [${val.slice(1)}]`;
			return `${id} label changed`;
		}
		default:
			return `${id} updated`;
	}
}

export function useMutations() {
	return {
		get value() { return mutations; },
		get recent() { return mutations.slice(0, 50); },
		get loading() { return loading; }
	};
}
