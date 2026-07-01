import type { Issue } from '$lib/types';

export const FLOW_CTX = Symbol('bdk-flow');

/** Layout modes for the flow view. */
export type FlowLayout = 'deps' | 'groups' | 'timeline';

/** Dimension to cluster nodes by in the 'groups' layout. */
export type GroupDim = 'label' | 'status' | 'assignee' | 'priority' | 'type';

/** Reactive bridge from FlowView to its custom nodes. */
export interface FlowContext {
	/** Live issue lookup — reads a $derived map so nodes track data changes. */
	getIssue: (id: string) => Issue | undefined;
	/** Currently selected issue id (drives node highlight). */
	getSelectedId: () => string | null;
}
