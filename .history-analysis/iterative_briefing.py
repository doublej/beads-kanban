#!/usr/bin/env python3
"""
Iterative Briefing Generator using Claude Agent SDK

Each iteration:
1. Takes current briefing (starts with seed or empty)
2. Combines with next N messages from timeline
3. Produces updated briefing as output
4. Each request is a NEW session (no memory carryover)

Usage:
    pip install claude-agent-sdk
    python iterative_briefing.py [--chunk-size N] [--seed FILE]

Examples:
    python iterative_briefing.py
    python iterative_briefing.py --chunk-size 20
    python iterative_briefing.py --seed existing_briefing.md
    python iterative_briefing.py --chunk-size 15 --seed BRIEFING.md

    # From clipboard (macOS)
    pbpaste | python iterative_briefing.py --seed -
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, TextBlock, ResultMessage

from datetime import datetime

TIMELINE_PATH = Path(__file__).parent / "chronological_timeline.json"
OUTPUT_DIR = Path(__file__).parent


def load_timeline() -> list[dict]:
    """Load the chronological timeline."""
    with open(TIMELINE_PATH) as f:
        return json.load(f)


def format_event(event: dict) -> str | None:
    """Format a single timeline event for the prompt. Returns None to skip."""
    if event["type"] == "message":
        return f"[USER MESSAGE] {event['content']}"
    elif event["type"] == "bead_created":
        return f"[TICKET CREATED] {event['id']}: {event['title']}\n  Description: {event.get('description', 'N/A')}\n  Type: {event.get('issue_type', 'task')} | Priority: {event.get('priority', 2)}"
    # Skip bead_closed events - not useful for briefing
    elif event["type"] == "bead_closed":
        return None
    return None


def chunk_events(events: list[dict], size: int) -> list[list[dict]]:
    """Split events into chunks of given size."""
    return [events[i:i + size] for i in range(0, len(events), size)]


async def process_chunk(current_briefing: str, chunk: list[dict], chunk_num: int, total_chunks: int, model: str | None = None) -> str:
    """
    Process a single chunk and return updated briefing.
    Each call is a NEW session - no memory of previous calls.
    """
    # Format the events for this chunk (filter out None)
    formatted = [format_event(e) for e in chunk]
    events_text = "\n\n".join(f for f in formatted if f)

    prompt = f"""You are building a project briefing by processing chronological events.

## Current Briefing (what we know so far):
{current_briefing if current_briefing else "(Empty - this is the first chunk)"}

---

## New Events to Process (chunk {chunk_num}/{total_chunks}):
{events_text}

---

## Your Task:
Analyze these new events and produce an UPDATED BRIEFING that:
1. Preserves all existing knowledge from the current briefing
2. Integrates new facts, preferences, and instructions from these events
3. Notes any CORRECTIONS or REJECTIONS where the user changed their mind
4. Captures design preferences, tech stack decisions, workflow rules

IMPORTANT: Do NOT track implementation status (broken, not working, WIP, etc).
If something is mentioned as broken or not yet implemented, just capture the END GOAL -
what the feature SHOULD do when complete. The briefing is about WHAT to build, not current state.

## Output Format:
Return ONLY the updated briefing as markdown. No explanations, no "here's the updated briefing" preamble.
The briefing should be a clean, organized document that could be given to a new developer.

Categories to track:
- Project Identity & Purpose
- Tech Stack & Architecture
- Design Philosophy & Preferences
- Explicit Rejections (what NOT to do)
- Positive Feedback (what to preserve)
- Workflow & Process Rules
- Features & End Goals (what each feature should do)
"""

    options = ClaudeAgentOptions(
        system_prompt="You are a technical documentation specialist. Extract and accumulate project knowledge from chronological events into a comprehensive briefing document. Be precise and factual.",
        max_turns=1,  # Single response, no back-and-forth
        model=model
    )

    response_text = ""

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    # Print to console as it streams
                    print(block.text, end="", flush=True)
                    response_text += block.text
        elif isinstance(message, ResultMessage):
            print(f"\n  [Chunk {chunk_num}: {message.num_turns} turns, ${message.total_cost_usd or 0:.4f}]")

    return response_text.strip()


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate project briefing from session history"
    )
    parser.add_argument(
        "--chunk-size", "-c",
        type=int,
        default=10,
        help="Number of events per chunk (default: 10)"
    )
    parser.add_argument(
        "--seed", "-s",
        type=Path,
        default=None,
        help="Path to seed briefing file to start from (use - for stdin)"
    )
    parser.add_argument(
        "--start-chunk", "-n",
        type=int,
        default=1,
        help="Starting chunk number (default: 1)"
    )
    parser.add_argument(
        "--start-event", "-e",
        type=int,
        default=0,
        help="Starting event index (default: 0, process all)"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=None,
        choices=["sonnet", "opus", "haiku"],
        help="Model to use (default: sonnet)"
    )
    # Note: --thinking not supported in SDK yet
    return parser.parse_args()


async def main():
    """Main iterative loop."""
    args = parse_args()
    chunk_size = args.chunk_size

    # Load seed briefing if provided
    if args.seed:
        if str(args.seed) == "-":
            # Read from stdin (e.g., pbpaste | python script.py --seed -)
            print("Reading seed briefing from stdin...")
            current_briefing = sys.stdin.read()
            print(f"Seed briefing: {len(current_briefing)} characters")
        elif args.seed.exists():
            print(f"Loading seed briefing from: {args.seed}")
            current_briefing = args.seed.read_text()
            print(f"Seed briefing: {len(current_briefing)} characters")
        else:
            print(f"Warning: Seed file not found: {args.seed}")
            print("Starting with empty briefing")
            current_briefing = ""
    else:
        current_briefing = ""

    print("Loading timeline...")
    events = load_timeline()

    # Filter useful events
    useful_events = [e for e in events if format_event(e) is not None]

    # Skip to starting event if specified
    if args.start_event > 0:
        print(f"Skipping first {args.start_event} events...")
        useful_events = useful_events[args.start_event:]

    chunks = chunk_events(useful_events, chunk_size)

    # Generate unique output filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = OUTPUT_DIR / f"BRIEFING_{timestamp}.md"

    print(f"Timeline has {len(events)} events ({len(useful_events)} useful)")
    print(f"Processing in {len(chunks)} chunks of {chunk_size}")
    print(f"Output: {output_path.name}")
    print("-" * 50)

    start_chunk = args.start_chunk
    if start_chunk > 1:
        print(f"Skipping to chunk {start_chunk}...")
        chunks = chunks[start_chunk - 1:]

    for i, chunk in enumerate(chunks, start_chunk):
        print(f"\nProcessing chunk {i}/{start_chunk + len(chunks) - 1}...")

        # Each call is a NEW session
        current_briefing = await process_chunk(
            current_briefing=current_briefing,
            chunk=chunk,
            chunk_num=i,
            total_chunks=len(chunks),
            model=args.model
        )

        # Save progress after each chunk
        output_path.write_text(f"# Accumulated Briefing\n\n**Progress:** {i}/{len(chunks)} chunks processed\n\n---\n\n{current_briefing}")

        # Brief pause between API calls
        await asyncio.sleep(0.5)

    print("\n" + "=" * 50)
    print(f"COMPLETE! Briefing saved to: {output_path}")
    print(f"Final briefing: {len(current_briefing)} characters")


if __name__ == "__main__":
    asyncio.run(main())
