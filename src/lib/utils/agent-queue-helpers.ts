export function formatCwdForDisplay(cwd: string, maxLength = 30): string {
	// Detect home directory pattern (e.g., /Users/username or /home/username)
	const homeMatch = cwd.match(/^(\/(?:Users|home)\/[^/]+)/);
	const shortened = homeMatch ? cwd.replace(homeMatch[1], '~') : cwd;

	if (shortened.length <= maxLength) return shortened;

	// Truncate middle: ~/.../<folder>
	const parts = shortened.split('/');
	if (parts.length > 3) {
		return `${parts[0]}/.../${parts[parts.length - 1]}`;
	}

	return shortened.slice(0, maxLength - 3) + '...';
}
