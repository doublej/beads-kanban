// Session persistence to localStorage for beads-kanban agent sessions
import type { AgentSession, ChatMessage } from './stores/ws-types';

const STORAGE_KEY = 'beads-kanban-sessions';
const SDK_SESSION_KEY = 'beads-kanban-sdk-sessions';

function getSdkMap(): Record<string, string> {
	return JSON.parse(localStorage.getItem(SDK_SESSION_KEY) ?? '{}');
}

async function fetchFromAgent<T>(path: string, empty: T): Promise<T> {
	if (typeof window === 'undefined') return empty;
	try {
		const host = window.location.hostname;
		const res = await fetch(`http://${host}:9347${path}`);
		if (!res.ok) return empty;
		return await res.json();
	} catch {
		return empty;
	}
}

export function persistSdkSessionId(sessionName: string, sdkSessionId: string) {
	if (typeof window === 'undefined') return;
	const map = getSdkMap();
	map[sessionName] = sdkSessionId;
	localStorage.setItem(SDK_SESSION_KEY, JSON.stringify(map));
}

export function clearPersistedSdkSessionId(sessionName: string) {
	if (typeof window === 'undefined') return;
	const map = getSdkMap();
	delete map[sessionName];
	localStorage.setItem(SDK_SESSION_KEY, JSON.stringify(map));
}

export function getPersistedSdkSessionId(sessionName: string): string | undefined {
	if (typeof window === 'undefined') return undefined;
	return getSdkMap()[sessionName];
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
	try {
		return Object.entries(getSdkMap()).map(([name, sdkSessionId]) => ({ name, sdkSessionId }));
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

export async function fetchSessionHistory(cwd: string, sessionId: string): Promise<ChatMessage[]> {
	const data = await fetchFromAgent<{ messages?: ChatMessage[] }>(
		`/sessions/${sessionId}/history?cwd=${encodeURIComponent(cwd)}`,
		{}
	);
	return data.messages ?? [];
}

export async function fetchSdkSessions(cwd: string): Promise<SdkSessionInfo[]> {
	const data = await fetchFromAgent<{ sessions?: SdkSessionInfo[] }>(
		`/sessions?cwd=${encodeURIComponent(cwd)}`,
		{}
	);
	return data.sessions ?? [];
}
