import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAllIssues } from '$lib/db'

export const GET: RequestHandler = async ({ params }) => {
	const issues = getAllIssues()
	const children = issues.filter(issue =>
		issue.dependencies?.some(d => d.id === params.id && d.dependency_type === 'parent-child')
	)

	return json({ children: children.map(c => ({ id: c.id, title: c.title, status: c.status })) })
}
