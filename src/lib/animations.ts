/**
 * Add an ID to a reactive Set for a duration, then remove it.
 * Used for CSS animation triggers on cards/issues.
 */
export function triggerAnimation(
	get: () => Set<string>,
	set: (v: Set<string>) => void,
	id: string,
	ms = 600
): void {
	set(new Set([...get(), id]));
	setTimeout(() => {
		set(new Set([...get()].filter(x => x !== id)));
	}, ms);
}
