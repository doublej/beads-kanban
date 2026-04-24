/**
 * Centralised zod schemas for every mutating endpoint.
 *
 * Use parseBody(request, schema) inside a wrap()'d handler. Validation failure
 * throws ApiError(400, 'VALIDATION', details: zodIssue[]).
 */
import { z } from 'zod';
import { ApiError } from './response';

const Priority = z.number().int().min(0).max(4);
const Status = z.enum(['open', 'in_progress', 'hooked', 'blocked', 'closed']);

export const CreateIssueSchema = z.object({
	title: z.string().min(1, 'title required'),
	description: z.string().optional(),
	priority: Priority.optional(),
	issue_type: z.string().optional(),
	assignee: z.string().optional(),
	labels: z.array(z.string()).optional(),
	deps: z.array(z.string()).optional(),
	dependencies: z.array(z.string()).optional(),
});

export const UpdateIssueSchema = z.object({
	status: Status.optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	priority: Priority.optional(),
	issue_type: z.string().optional(),
	design: z.string().optional(),
	acceptance_criteria: z.string().optional(),
	notes: z.string().optional(),
	assignee: z.string().nullable().optional(),
	addLabels: z.array(z.string()).optional(),
	removeLabels: z.array(z.string()).optional(),
	agent_model: z.string().nullable().optional(),
	agent_effort: z.string().nullable().optional(),
});

export const AddCommentSchema = z.object({
	text: z.string().min(1, 'text required'),
});

export const AddDependencySchema = z.object({
	depends_on: z.string().min(1, 'depends_on required'),
	dep_type: z.string().optional(),
});

export const RemoveDependencySchema = z.object({
	depends_on: z.string().min(1, 'depends_on required'),
});

export const SetCwdSchema = z.object({
	path: z.string().min(1, 'path required'),
});

export async function parseBody<T extends z.ZodTypeAny>(
	request: Request,
	schema: T,
): Promise<z.infer<T>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw new ApiError('Invalid JSON body', 400, 'VALIDATION');
	}
	const result = schema.safeParse(raw);
	if (!result.success) {
		throw new ApiError('Validation failed', 400, 'VALIDATION', result.error.issues);
	}
	return result.data;
}
