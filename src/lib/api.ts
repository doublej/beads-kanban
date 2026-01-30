import type { Issue, Comment, Attachment } from './types';
import { fetchJSON, postJSON, patchJSON, deleteJSON, postFormData } from './http';

export async function updateIssue(id: string, updates: Partial<Issue>): Promise<void> {
	await patchJSON(`/api/issues/${id}`, updates);
}

export async function deleteIssueApi(id: string): Promise<void> {
	await deleteJSON(`/api/issues/${id}`);
}

export async function closeIssueApi(id: string, reason = 'Completed'): Promise<{ success?: boolean; error?: string }> {
	return postJSON(`/api/issues/${id}/close`, { reason });
}

export async function createIssueApi(form: { title: string; description: string; priority: number; issue_type: string }): Promise<void> {
	await postJSON('/api/issues', form);
}

export async function loadComments(issueId: string): Promise<Comment[]> {
	const data = await fetchJSON<{ comments?: Comment[] }>(`/api/issues/${issueId}/comments`);
	return data.comments || [];
}

export async function addCommentApi(issueId: string, text: string): Promise<void> {
	await postJSON(`/api/issues/${issueId}/comments`, { text });
}

export async function createDependencyApi(fromId: string, toId: string, depType = 'blocks'): Promise<{ success?: boolean; error?: string }> {
	return postJSON(`/api/issues/${fromId}/deps`, { depends_on: toId, dep_type: depType });
}

export async function removeDependencyApi(issueId: string, dependsOnId: string): Promise<{ success?: boolean; error?: string }> {
	return deleteJSON(`/api/issues/${issueId}/deps`, { depends_on: dependsOnId });
}

export async function loadAttachmentsApi(issueId: string): Promise<Attachment[]> {
	const data = await fetchJSON<{ attachments?: Attachment[] }>(`/api/issues/${issueId}/attachments`);
	return data.attachments || [];
}

export async function uploadAttachmentApi(issueId: string, file: File): Promise<Attachment | null> {
	const formData = new FormData();
	formData.append('file', file);
	const data = await postFormData<{ attachment?: Attachment }>(`/api/issues/${issueId}/attachments`, formData);
	return data.attachment || null;
}

export async function deleteAttachmentApi(issueId: string, filename: string): Promise<void> {
	await deleteJSON(`/api/issues/${issueId}/attachments/${encodeURIComponent(filename)}`);
}

export async function renameIssueApi(id: string, newId: string): Promise<{ success?: boolean; error?: string }> {
	return postJSON(`/api/issues/${id}/rename`, { newId });
}

export async function getChildrenApi(id: string): Promise<{ id: string; title: string; status: string }[]> {
	const data = await fetchJSON<{ children?: { id: string; title: string; status: string }[] }>(`/api/issues/${id}/children`);
	return data.children || [];
}

export async function getTypesApi(): Promise<string[]> {
	const data = await fetchJSON<{ types?: string[] }>('/api/types');
	return data.types || [];
}
