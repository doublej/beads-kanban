import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getTypes } from '$lib/bd'

const DEFAULT_TYPES = ['task', 'bug', 'feature', 'enhancement', 'epic', 'chore']

export const GET: RequestHandler = async () => {
	const result = await getTypes()

	if (result.success && result.stdout) {
		try {
			const types = JSON.parse(result.stdout)
			return json({ types })
		} catch {
			// Fall through to defaults
		}
	}

	return json({ types: DEFAULT_TYPES })
}
