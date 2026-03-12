// Manager agent UI state
import { browser } from '$app/environment';

export const MANAGER_SESSION_NAME = '__manager__';

let isManagerVisible = $state(
	browser ? localStorage.getItem('managerVisible') === 'true' : false
);

export function getManagerVisible(): boolean {
	return isManagerVisible;
}

export function setManagerVisible(v: boolean) {
	isManagerVisible = v;
	if (browser) localStorage.setItem('managerVisible', String(v));
}

export function toggleManagerVisibility() {
	setManagerVisible(!isManagerVisible);
}
