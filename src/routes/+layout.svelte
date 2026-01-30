<script lang="ts">
	import { browser } from '$app/environment';
	import '$lib/styles/components.css';
	import '$lib/styles/global.css';
	import { pushService } from '$lib/notifications/push-service';

	let { data, children } = $props();

	let isDarkMode = $state(true);

	$effect(() => {
		if (browser) {
			const saved = localStorage.getItem('theme');
			if (saved) {
				isDarkMode = saved === 'dark';
			} else {
				isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}

			// Initialize push service for browser notifications
			pushService.init();

			const handleStorage = (e: StorageEvent) => {
				if (e.key === 'theme') {
					isDarkMode = e.newValue === 'dark';
				}
			};
			window.addEventListener('storage', handleStorage);

			return () => window.removeEventListener('storage', handleStorage);
		}
	});

	const themeColor = $derived(isDarkMode ? '#3f3f46' : '#f5f5f5');
</script>

<svelte:head>
	<title>{data.folderName} - Strandkanban</title>
	<meta name="theme-color" content={themeColor} />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>

{@render children()}
