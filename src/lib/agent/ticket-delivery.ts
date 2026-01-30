import type { Issue, Comment, Attachment } from '$lib/types';
import type { SdkSessionInfo } from '$lib/session-persistence';

export interface TicketDeliveryData {
	issue: Issue;
	comments?: Comment[];
	attachments?: Attachment[];
}

/**
 * Format a ticket delivery message by substituting placeholders in the template.
 * Pure function - takes the template as a parameter so it doesn't depend on component state.
 */
export function formatTicketDelivery(agentName: string, data: TicketDeliveryData, template: string): string {
	const { issue, comments = [], attachments = [] } = data;

	const commentsStr = comments.length > 0
		? comments.map(c => `[${c.author} @ ${new Date(c.created_at).toLocaleString()}]: ${c.text}`).join('\n')
		: 'No comments';

	const attachmentsStr = attachments.length > 0
		? attachments.map(a => `- ${a.filename} (${(a.size / 1024).toFixed(1)}KB)`).join('\n')
		: 'No attachments';

	const depsStr = issue.dependencies && issue.dependencies.length > 0
		? issue.dependencies.map(d => `- ${d.id}: ${d.title} [${d.status}] (${d.dependency_type})`).join('\n')
		: 'None';

	const dependentsStr = issue.dependents && issue.dependents.length > 0
		? issue.dependents.map(d => `- ${d.id}: ${d.title} [${d.status}] (${d.dependency_type})`).join('\n')
		: 'None';

	return template
		.replace(/{name}/g, agentName)
		.replace(/{id}/g, issue.id)
		.replace(/{title}/g, issue.title)
		.replace(/{description}/g, issue.description || 'No description')
		.replace(/{comments}/g, commentsStr)
		.replace(/{attachments}/g, attachmentsStr)
		.replace(/{dependencies}/g, depsStr)
		.replace(/{dependents}/g, dependentsStr);
}

/** Filter out empty/failed SDK sessions (warmup-only, no conversation, or failed starts) */
export function isValidSession(s: SdkSessionInfo): boolean {
	if (s.preview.length === 0) return false;
	const warmupPatterns = [/^warmup$/i, /^no conversation$/i, /^i'll explore/i, /^let me/i];
	const meaningfulLines = s.preview.filter(line => {
		const clean = line.replace(/^>\s*/, '').trim();
		return clean.length > 20 && !warmupPatterns.some(p => p.test(clean));
	});
	return meaningfulLines.length >= 2 || !!s.summary;
}
