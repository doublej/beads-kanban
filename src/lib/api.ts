import type { Issue, Comment, Attachment } from './types';

export async function updateIssue(id: string, updates: Partial<Issue>): Promise<void> {
	await fetch(`/api/issues/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	});
}

export async function deleteIssueApi(id: string): Promise<void> {
	await fetch(`/api/issues/${id}`, { method: 'DELETE' });
}

export async function createIssueApi(form: { title: string; description: string; priority: number; issue_type: string }): Promise<void> {
	await fetch('/api/issues', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(form)
	});
}

export async function loadComments(issueId: string): Promise<Comment[]> {
	const res = await fetch(`/api/issues/${issueId}/comments`);
	const data = await res.json();
	return data.comments || [];
}

export async function addCommentApi(issueId: string, text: string): Promise<void> {
	await fetch(`/api/issues/${issueId}/comments`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text })
	});
}

export async function createDependencyApi(fromId: string, toId: string, depType = 'blocks'): Promise<{ success?: boolean; error?: string }> {
	const res = await fetch(`/api/issues/${fromId}/deps`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ depends_on: toId, dep_type: depType })
	});
	return res.json();
}

export async function removeDependencyApi(issueId: string, dependsOnId: string): Promise<{ success?: boolean; error?: string }> {
	const res = await fetch(`/api/issues/${issueId}/deps`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ depends_on: dependsOnId })
	});
	return res.json();
}

export async function loadAttachmentsApi(issueId: string): Promise<Attachment[]> {
	const res = await fetch(`/api/issues/${issueId}/attachments`);
	const data = await res.json();
	return data.attachments || [];
}

export async function uploadAttachmentApi(issueId: string, file: File): Promise<Attachment | null> {
	const formData = new FormData();
	formData.append('file', file);
	const res = await fetch(`/api/issues/${issueId}/attachments`, {
		method: 'POST',
		body: formData
	});
	const data = await res.json();
	return data.attachment || null;
}

export async function deleteAttachmentApi(issueId: string, filename: string): Promise<void> {
	await fetch(`/api/issues/${issueId}/attachments/${encodeURIComponent(filename)}`, {
		method: 'DELETE'
	});
}
