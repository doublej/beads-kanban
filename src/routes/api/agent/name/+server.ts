import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unstable_v2_prompt } from '@anthropic-ai/claude-agent-sdk';
import { log } from '$lib/server/logger';

const PROMPT = `Name a coding agent for "beads-kanban" (task tracker with bead/string theme).

Pick ONE random vibe and invent a funny name:
- BEAD PUNS: "bead" = "be/beat" wordplay
- GEM JOKES: geology/gemstone humor
- STRING THEORY: thread/knot/weave puns
- SEA VIBES: pearl/shell/ocean creatures
- CODER CHAOS: bugs/caffeine/git jokes
- POP CULTURE: movies/memes + coding
- FOOD MASHUPS: snacks + programming
- ANIMAL CODERS: creatures + tech

STRICT RULES:
- Exactly 2 words, hyphenated, lowercase (e.g. "clam-debugger")
- Be creative - invent new combos
- Dad-joke energy preferred

Output the name only. No explanation. No alternatives.`;

export const POST: RequestHandler = async () => {
	try {
		const result = await unstable_v2_prompt(PROMPT, {
			model: 'claude-haiku-4-5-20251001',
		});

		if (result.subtype !== 'success' || !result.result) {
			return json({ error: 'Failed to generate name' }, { status: 500 });
		}

		const name = result.result.trim().toLowerCase().replace(/\s+/g, '-');

		return json({ name });
	} catch (error) {
		log.error('[agent/name] Error generating name:', error);
		return json({ error: 'Failed to generate name' }, { status: 500 });
	}
};
