import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

interface Dependency {
	id: string;
	title: string;
	status: string;
	dependency_type: string;
}

interface IssueDetail {
	id: string;
	title: string;
	description: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	labels?: string[];
	created_at: string;
	updated_at: string;
	closed_at?: string;
	dependencies?: Dependency[];
	dependents?: Dependency[];
	dependency_count: number;
	dependent_count: number;
}

async function enrichIssues(basicIssues: IssueDetail[]): Promise<IssueDetail[]> {
	const needsEnrichment = basicIssues.filter(
		(i) => i.dependency_count > 0 || i.dependent_count > 0
	);

	if (needsEnrichment.length === 0) return basicIssues;

	const enriched = await Promise.all(
		needsEnrichment.map(async (issue) => {
			const { stdout } = await execAsync(`bd show ${issue.id} --json`);
			const [detail] = JSON.parse(stdout);
			return detail as IssueDetail;
		})
	);

	const enrichedMap = new Map(enriched.map((i) => [i.id, i]));

	return basicIssues.map((issue) => enrichedMap.get(issue.id) || issue);
}

export const GET: RequestHandler = async () => {
	let interval: ReturnType<typeof setInterval> | null = null;
	let closed = false;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let lastData = '';

			const sendUpdate = async () => {
				if (closed) return;
				const { stdout } = await execAsync('bd list --json');
				const data = stdout.trim();

				if (data !== lastData && !closed) {
					lastData = data;
					const basicIssues = JSON.parse(data) as IssueDetail[];
					const issues = await enrichIssues(basicIssues);
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ issues })}\n\n`));
				}
			};

			interval = setInterval(async () => {
				await sendUpdate();
			}, 2000);

			await sendUpdate();
		},
		cancel() {
			closed = true;
			if (interval) clearInterval(interval);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
