<script lang="ts">
	import { onDestroy } from 'svelte';
	import { notifications } from '$lib/stores/notificationStore';
	import type { Notification } from '$lib/types/notification';

	export let notification: Notification;

	let timeoutId: number;

	function removeNotification() {
		notifications.remove(notification.id);
	}

	function startTimer() {
		if (notification.timeout) {
			timeoutId = setTimeout(removeNotification, notification.timeout);
		}
	}

	function clearTimer() {
		clearTimeout(timeoutId);
	}

	startTimer();

	onDestroy(() => {
		clearTimer();
	});
</script>

<div
	class="notification {notification.type}"
	on:mouseenter={clearTimer}
	on:mouseleave={startTimer}
	role="alert"
>
	<div class="notification-content">
		{#if notification.title}
			<h3 class="notification-title">{notification.title}</h3>
		{/if}
		<p class="notification-message">{notification.message}</p>
	</div>
	<button class="notification-close" on:click={removeNotification}> &times; </button>
</div>

<style>
	.notification {
		position: relative;
		padding: 1rem;
		margin-bottom: 0.5rem;
		border-radius: 0.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: white;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		transition:
			opacity 0.3s ease-in-out,
			transform 0.3s ease-in-out;
		opacity: 1;
		transform: translateY(0);
	}

	.notification.success {
		background-color: #28a745;
	}

	.notification.error {
		background-color: #dc3545;
	}

	.notification.warning {
		background-color: #ffc107;
		color: #333;
	}

	.notification.info {
		background-color: #17a2b8;
	}

	.notification-content {
		flex-grow: 1;
		margin-right: 1rem;
	}

	.notification-title {
		margin-top: 0;
		margin-bottom: 0.25rem;
		font-weight: bold;
	}

	.notification-message {
		margin: 0;
	}

	.notification-close {
		background: none;
		border: none;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0 0.5rem;
	}

	.notification.warning .notification-close {
		color: #333;
	}
</style>
