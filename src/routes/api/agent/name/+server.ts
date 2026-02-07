import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const PROMPT = `You're naming an AI coding agent for "beads-kanban" - a task tracker where issues are like beads strung together.

Creative directions to explore:
• Bead/gem/jewelry wordplay mixed with coding terms
• Thread/string puns (threading, stringing, weaving)
• Kanban flow metaphors (columns, cards, lanes)
• Nautical (pearls, diving, oysters) meets programming
• Alliterative combos that sound fun to say
• Dad-joke-level puns that make developers groan-smile

Invent something fresh and memorable. Mash up unexpected concepts. Channel the spirit of a witty coworker naming their shell alias.

Format: 1-3 words, lowercase, hyphenated. Output only the name.`;

export const POST: RequestHandler = async () => {
	try {
		const message = await anthropic.messages.create({
			model: 'claude-haiku-4-20250514',
			max_tokens: 50,
			messages: [{ role: 'user', content: PROMPT }],
		});

		const textBlock = message.content[0];
		if (textBlock.type !== 'text') {
			return json({ error: 'Unexpected response type' }, { status: 500 });
		}

		const name = textBlock.text.trim().toLowerCase().replace(/\s+/g, '-');

		return json({ name });
	} catch (error) {
		console.error('[agent/name] Error generating name:', error);
		return json({ error: 'Failed to generate name' }, { status: 500 });
	}
};
