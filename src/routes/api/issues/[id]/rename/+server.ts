import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { renameIssue } from '$lib/bd'

export const POST: RequestHandler = async ({ params, request }) => {
	const { newId } = await request.json()

	if (!newId?.trim()) {
		return json({ error: 'newId is required' }, { status: 400 })
	}

	const result = await renameIssue(params.id, newId.trim())

	if (!result.success) {
		return json({ error: result.error }, { status: 500 })
	}

	return json({ success: true, message: result.stdout })
}
