<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toastQueue } from '$lib/notifications/toast-queue.svelte';

	const POLL_MS = 2000;

	type Ping = { ok: boolean; total_ms?: number; error?: string };
	type Finding = { severity?: string; message?: string; fixed?: boolean };

	let ping = $state<Ping | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function tick() {
		try {
			const res = await fetch('/api/health');
			const body = (await res.json()) as { data?: { ping: Ping; doctor?: { findings: Finding[] } } };
			const data = body.data;
			if (!data) return;
			ping = data.ping;
			if (data.doctor && data.doctor.findings.length > 0) {
				toastQueue.show({
					type: 'warning',
					title: 'bd doctor: findings',
					message: data.doctor.findings.map((f) => f.message ?? '').filter(Boolean).join(' · '),
					duration: 8000
				});
			}
		} catch (err) {
			ping = { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	onMount(() => {
		tick();
		timer = setInterval(tick, POLL_MS);
	});

	onDestroy(() => {
		if (timer !== null) clearInterval(timer);
	});

	const color = $derived(ping == null ? '#9ca3af' : ping.ok ? '#22c55e' : '#ef4444');
	const title = $derived(
		ping == null ? 'bd: checking…'
		: ping.ok ? `bd healthy (${ping.total_ms ?? '?'} ms)`
		: `bd unhealthy: ${ping.error ?? 'no response'}`
	);
</script>

<span class="health-badge" {title} aria-label={title}>
	<span class="dot" style:background-color={color}></span>
	bd
</span>

<style>
	.health-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.1em 0.5em;
		font-size: 0.75rem;
		color: var(--text-muted, #6b7280);
		border: 1px solid var(--border-subtle, #e5e7eb);
		border-radius: 9999px;
	}
	.dot {
		display: inline-block;
		width: 0.55em;
		height: 0.55em;
		border-radius: 50%;
	}
</style>
