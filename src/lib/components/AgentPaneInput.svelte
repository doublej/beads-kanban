<script lang="ts">
	import type { Pane, SlashCommandInfo } from '$lib/wsStore.svelte';

	interface Props {
		pane: Pane;
		messageInput: string;
		disabled: boolean;
		inputRef: HTMLInputElement | null;
		onSendMessage: (name: string, message: string) => void;
		onInputChange: (value: string) => void;
	}

	let {
		pane,
		messageInput = $bindable(),
		disabled,
		inputRef = $bindable(),
		onSendMessage,
		onInputChange
	}: Props = $props();

	let slashMenuOpen = $state(false);
	let slashMenuIndex = $state(0);

	function getFilteredSlashCommands(): SlashCommandInfo[] {
		const commands = pane.slashCommands || [];
		if (!messageInput.startsWith('/')) return [];
		const query = messageInput.slice(1).toLowerCase();
		return commands.filter(cmd => {
			const name = cmd.name.toLowerCase();
			return name.startsWith(query) || name.includes(query) ||
				cmd.description.toLowerCase().includes(query);
		});
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		slashMenuOpen = false;
		if (messageInput?.trim()) {
			onSendMessage(pane.name, messageInput.trim());
			onInputChange('');
		}
	}

	function handleChange(value: string) {
		onInputChange(value);
		if (value.startsWith('/') && value.length >= 1) {
			slashMenuOpen = true;
			slashMenuIndex = 0;
		} else {
			slashMenuOpen = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!slashMenuOpen) return;
		const filtered = getFilteredSlashCommands();
		if (filtered.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			slashMenuIndex = (slashMenuIndex + 1) % filtered.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			slashMenuIndex = (slashMenuIndex - 1 + filtered.length) % filtered.length;
		} else if (e.key === 'Tab' || e.key === 'Enter') {
			if (filtered.length > 0) {
				e.preventDefault();
				const cmd = filtered[slashMenuIndex];
				onInputChange('/' + cmd.name + ' ');
				slashMenuOpen = false;
			}
		} else if (e.key === 'Escape') {
			slashMenuOpen = false;
		}
	}

	function selectSlashCommand(command: string) {
		onInputChange(command + ' ');
		slashMenuOpen = false;
		inputRef?.focus();
	}
</script>

<form class="input-row" onsubmit={handleSubmit}>
	<div class="input-wrapper">
		<input
			type="text"
			bind:this={inputRef}
			value={messageInput || ''}
			oninput={(e) => handleChange(e.currentTarget.value)}
			onkeydown={handleKeydown}
			onblur={() => setTimeout(() => { slashMenuOpen = false; }, 150)}
			placeholder={disabled ? "connecting..." : pane.slashCommands?.length ? "/ for commands" : ">"}
			class="msg-input"
			{disabled}
		/>
		{#if slashMenuOpen}
			{@const filtered = getFilteredSlashCommands()}
			{#if filtered.length > 0}
				<div class="slash-menu">
					{#each filtered.slice(0, 8) as cmd, i}
						<button
							type="button"
							class="slash-item"
							class:selected={i === slashMenuIndex}
							onmousedown={() => selectSlashCommand('/' + cmd.name)}
						>
							<span class="slash-cmd">/{cmd.name}</span>
							{#if cmd.argumentHint}
								<span class="slash-hint">{cmd.argumentHint}</span>
							{/if}
							{#if cmd.description}
								<span class="slash-desc">{cmd.description}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
	<button type="submit" class="send-btn" disabled={disabled || !messageInput?.trim()}>
		{#if disabled}
			<span class="spinner"></span>
		{:else}
			&#8629;
		{/if}
	</button>
</form>

<style>
	.input-row {
		display: flex;
		gap: 0.25rem;
		padding: 0.375rem;
		background: rgba(0, 0, 0, 0.15);
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		flex-shrink: 0;
	}

	:global(.app.light) .input-row {
		background: rgba(0, 0, 0, 0.03);
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	.input-wrapper { position: relative; flex: 1; display: flex; }
	.input-wrapper .msg-input { flex: 1; width: 100%; }

	.slash-menu {
		position: absolute;
		bottom: 100%;
		left: 0; right: 0;
		margin-bottom: 4px;
		background: var(--bg-secondary, #1a1a1e);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		animation: slashMenuIn 100ms ease;
		z-index: 100;
	}

	@keyframes slashMenuIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

	.slash-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 10px;
		background: transparent;
		border: none;
		font: 11px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-primary);
		cursor: pointer;
		text-align: left;
		transition: background 60ms ease;
	}

	.slash-item:hover, .slash-item.selected { background: rgba(99, 102, 241, 0.15); }

	.slash-cmd { color: #6366f1; font-weight: 500; flex-shrink: 0; }
	.slash-hint { color: var(--text-tertiary, #666); font-size: 10px; flex-shrink: 0; }
	.slash-desc {
		color: var(--text-secondary, #888);
		font-size: 10px;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		flex: 1; text-align: right;
	}

	:global(.app.light) .slash-menu { background: var(--surface-elevated); border-color: var(--border-default); box-shadow: var(--shadow-lg); }
	:global(.app.light) .slash-item:hover, :global(.app.light) .slash-item.selected { background: rgba(99, 102, 241, 0.1); }

	.msg-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		font: 11px/1.2 'IBM Plex Mono', ui-monospace, monospace;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid transparent;
		border-radius: 4px;
		color: var(--text-primary);
		transition: all 100ms ease;
	}

	.msg-input:focus { outline: none; background: rgba(255, 255, 255, 0.1); border-color: rgba(99, 102, 241, 0.4); }
	.msg-input::placeholder { color: var(--text-tertiary); opacity: 0.6; }
	.msg-input:disabled { opacity: 0.5; cursor: not-allowed; }

	:global(.app.light) .msg-input { background: rgba(0, 0, 0, 0.04); }
	:global(.app.light) .msg-input:focus { background: rgba(0, 0, 0, 0.06); }

	.send-btn {
		width: 28px; height: 28px;
		display: flex; align-items: center; justify-content: center;
		background: rgba(99, 102, 241, 0.9);
		border: none; border-radius: 4px;
		color: white; font: 600 12px/1 system-ui;
		cursor: pointer; transition: all 100ms ease; flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) { background: #6366f1; }
	.send-btn:active:not(:disabled) { transform: scale(0.95); }
	.send-btn:disabled { background: rgba(255, 255, 255, 0.08); color: var(--text-tertiary); cursor: default; }

	:global(.app.light) .send-btn:disabled { background: rgba(0, 0, 0, 0.06); }

	.spinner {
		width: 10px; height: 10px;
		border: 1.5px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 768px) {
		.input-row { padding: 0.5rem; }
		.msg-input { padding: 0.5rem 0.625rem; font-size: 13px; }
		.send-btn { width: 36px; height: 36px; }
	}
</style>
