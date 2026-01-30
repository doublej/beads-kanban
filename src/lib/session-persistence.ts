// Session persistence to localStorage for beads-kanban agent sessions
import type { AgentSession } from './stores/ws-types';

const STORAGE_KEY = 'beads-kanban-sessions';
const SDK_SESSION_KEY = 'beads-kanban-sdk-sessions';

export function persistSdkSessionId(sessionName: string, sdkSessionId: string) {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	const map: Record<string, string> = stored ? JSON.parse(stored) : {};
	map[sessionName] = sdkSessionId;
	localStorage.setItem(SDK_SESSION_KEY, JSON.stringify(map));
}

export function clearPersistedSdkSessionId(sessionName: string) {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	if (!stored) return;
	const map: Record<string, string> = JSON.parse(stored);
	delete map[sessionName];
	localStorage.setItem(SDK_SESSION_KEY, JSON.stringify(map));
}

export function getPersistedSdkSessionId(sessionName: string): string | undefined {
	if (typeof window === 'undefined') return undefined;
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	if (!stored) return undefined;
	const map: Record<string, string> = JSON.parse(stored);
	return map[sessionName];
}

export function loadSessions(): Map<string, AgentSession> {
	if (typeof window === 'undefined') return new Map();
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return new Map();
	try {
		const arr: [string, AgentSession][] = JSON.parse(stored);
		return new Map(arr.map(([k, v]) => [k, { ...v, streaming: false, currentDelta: '' }]));
	} catch {
		return new Map();
	}
}

export function saveSessions(sessions: Map<string, AgentSession>) {
	if (typeof window === 'undefined') return;
	const toSave = Array.from(sessions.entries()).map(([k, v]) => {
		const { ...rest } = v;
		return [k, rest] as [string, AgentSession];
	});
	localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function getAllPersistedSessions(): { name: string; sdkSessionId: string }[] {
	if (typeof window === 'undefined') return [];
	const stored = localStorage.getItem(SDK_SESSION_KEY);
	if (!stored) return [];
	try {
		const map: Record<string, string> = JSON.parse(stored);
		return Object.entries(map).map(([name, sdkSessionId]) => ({ name, sdkSessionId }));
	} catch {
		return [];
	}
}

export function deletePersistedSession(sessionName: string) {
	clearPersistedSdkSessionId(sessionName);
}

export interface SdkSessionInfo {
	sessionId: string;
	agentName?: string;
	timestamp: string;
	summary?: string;
	preview: string[];
}

export async function fetchSdkSessions(cwd: string): Promise<SdkSessionInfo[]> {
	if (typeof window === 'undefined') return [];
	try {
		const host = window.location.hostname;
		const res = await fetch(`http://${host}:9347/sessions?cwd=${encodeURIComponent(cwd)}`);
		if (!res.ok) return [];
		const data = await res.json();
		return data.sessions || [];
	} catch {
		return [];
	}
}
