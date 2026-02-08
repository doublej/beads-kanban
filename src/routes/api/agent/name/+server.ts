import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unstable_v2_prompt } from '@anthropic-ai/claude-agent-sdk';

const PROMPT = `You're naming an AI coding agent for "beads-kanban" - a task tracker where issues are like beads strung together on a string.

Generate ONE creative agent name. Pick from these vibes (vary your choice):

🔮 GEM/BEAD wordplay: jade-juggler, quartz-coder, opal-ops, ruby-runner
📿 STRING/THREAD puns: string-theory, loop-weaver, knot-navigator, fiber-fixer
🌊 PEARL-DIVER energy: deep-diver, shell-seeker, reef-raider, tide-turner
🎯 KANBAN mashups: lane-legend, card-shark, flow-state, column-climber
🎲 PLAYFUL coding: byte-beader, git-gem, merge-marble, commit-crystal

Rules:
- 1-2 words max, hyphenated, lowercase
- Must sound fun to say out loud
- Should make a developer smile
- No generic names like "code-helper" or "task-bot"
- Be creative! Invent new combos

Output ONLY the name, nothing else.`;

export const POST: RequestHandler = async () => {
	try {
		const result = await unstable_v2_prompt(PROMPT, {
			model: 'claude-haiku-4-20250514',
		});

		if (result.subtype !== 'success' || !result.result) {
			return json({ error: 'Failed to generate name' }, { status: 500 });
		}

		const name = result.result.trim().toLowerCase().replace(/\s+/g, '-');

		return json({ name });
	} catch (error) {
		console.error('[agent/name] Error generating name:', error);
		return json({ error: 'Failed to generate name' }, { status: 500 });
	}
};
