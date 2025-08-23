<script lang="ts">
	import Header from './Header.svelte';
	import '../app.css';
	import { setWebSocketContext } from '$lib/context/websocket';
	import Notification from '$lib/components/Notification.svelte';
	import { notifications } from '$lib/stores/notificationStore';

	setWebSocketContext();

	let { children } = $props();
</script>

<div class="app">
	<Header />

	<div class="notification-container">
		{#each $notifications as notification (notification.id)}
			<Notification {notification} />
		{/each}
	</div>

	<main>
		{@render children()}
	</main>

	<footer></footer>
</div>

<style>
	.notification-container {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 1000;
		width: 100%;
		max-width: 20rem;
	}

	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 12px;
	}

	@media (min-width: 480px) {
		footer {
			padding: 12px 0;
		}
	}
</style>
