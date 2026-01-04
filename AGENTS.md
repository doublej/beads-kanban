# AGENTS.md

Agent-specific guidance. See CLAUDE.md for commands and architecture overview.

## Code Style
- **Svelte 5**: Use runes (`$state`, `$derived`, `$effect`), not legacy stores
- **TypeScript**: Strict mode enabled; define interfaces in `src/lib/types.ts`
- **Imports**: Use `$lib/` alias (e.g., `import { type Issue } from '$lib/types'`)
- **Formatting**: Tabs for indentation, single quotes, no semicolons in Svelte files
- **Naming**: camelCase for functions/vars, PascalCase for types/components
- **API functions**: Suffix with `Api` (e.g., `deleteIssueApi`, `createDependencyApi`)

## Architecture
- API routes (`src/routes/api/`) shell out to `bd` CLI commands
- Main UI in `src/routes/+page.svelte` (large file, ~3600+ lines)
- Issue status flow: `open` → `in_progress` → `hooked` → `blocked` → `closed`

## Error Handling
- API calls don't throw; check response for `{ error?: string }` pattern
- Let unexpected errors surface (no silent catches)
