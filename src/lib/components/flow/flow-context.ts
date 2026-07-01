import type { Issue } from '$lib/types';

export const FLOW_CTX = Symbol('bdk-flow');

/** Reactive bridge from FlowView to its custom nodes. */
export interface FlowContext {
	/** Live issue lookup — reads a $derived map so nodes track data changes. */
	getIssue: (id: string) => Issue | undefined;
	/** Currently selected issue id (drives node highlight). */
	getSelectedId: () => string | null;
}
