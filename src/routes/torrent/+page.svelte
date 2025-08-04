<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { API_URL, WS_URL } from '$lib/config/api';
	import { API_ENDPOINTS } from '$lib/utils/constants';
	import type { Torrent } from '$lib/types';
	import { convertingStateToString, stateToString } from '$lib/utils/mappers';

	let magnet: string = $state('');
	let torrents: Torrent[] = $state([]);
	let isLoading: boolean = $state(true);
	let error: string | null = $state(null);
	let ws: WebSocket | null = null;

	let sortBy = $state<'name' | 'infoHash' | 'progress'>('infoHash');
	let sortOrder = $state<'asc' | 'desc'>('asc');

	const sortedTorrents = $derived(
		torrents.toSorted((a, b) => {
			let result = 0;

			switch (sortBy) {
				case 'name':
					result = (a.name || a.infoHash).localeCompare(b.name || b.infoHash);
					break;
				case 'progress':
					result = a.downloadedPercent - b.downloadedPercent;
					break;
				case 'infoHash':
				default:
					result = a.infoHash.localeCompare(b.infoHash);
			}

			return sortOrder === 'desc' ? -result : result;
		})
	);

	// Загрузка существующих торрентов при инициализации
	async function loadTorrents() {
		try {
			isLoading = true;
			error = null;

			const response = await fetch(API_URL + API_ENDPOINTS.TORRENTS);

			if (!response.ok) {
				console.error(`Failed to load torrents: ${response.status}`);
				alert(`Failed to load torrents: ${response.status}`);
			}

			const data = await response.json();
			if (Array.isArray(data)) {
				torrents = data as Torrent[];
			} else {
				console.error('Invalid response format from server', data);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
			console.error('Error loading torrents:', err);
		} finally {
			isLoading = false;
		}
	}

	// Добавление торрента через API
	async function addTorrent() {
		if (!magnet.trim()) return;

		try {
			const response = await fetch(API_URL + API_ENDPOINTS.ADD_TORRENT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ source: magnet })
			});

			if (!response.ok) {
				console.error(`HTTP error! status: ${response.status}`);
				alert(`HTTP error! status: ${response.status}`);
			}

			// Очистка поля ввода после успешной отправки
			magnet = '';
		} catch (error) {
			console.error('Failed to add torrent:', error);
			alert('Failed to add torrent. Check console for details.');
		}
	}

	// Инициализация при монтировании компонента
	onMount(async () => {
		await loadTorrents();

		// Инициализация WebSocket соединения
		try {
			ws = new WebSocket(WS_URL);

			ws.onmessage = (event: MessageEvent) => {
				try {
					if (typeof event.data === 'string') {
						const data = JSON.parse(event.data);
						if (Array.isArray(data)) {
							torrents = data as Torrent[];
						}
					}
				} catch (e) {
					console.error('Failed to parse WebSocket message:', e);
				}
			};

			ws.onerror = (error: Event) => {
				console.error('WebSocket error:', error);
			};

			ws.onclose = (event: CloseEvent) => {
				if (event.code !== 1000) { // 1000 = нормальное закрытие
					console.warn(`WebSocket closed unexpectedly: [${event.code}] ${event.reason}`);
				}
			};
		} catch (error) {
			console.error('WebSocket initialization failed:', error);
		}
	});

	// Очистка при размонтировании компонента
	onDestroy(() => {
		if (ws) {
			ws.close(1000, 'Component unmounted');
			ws = null;
		}
	});
</script>

<svelte:head>
	<title>Torrent</title>
	<meta name="description" content="Torrent client" />
</svelte:head>

<div class="add-form">
	<button onclick={() => window.location.href = "/"}>Back</button>
	<input
		type="text"
		placeholder="Enter magnet link"
		bind:value={magnet} />
	<button onclick={addTorrent}>Add Torrent</button>
</div>

{#if isLoading}
	<div class="loading">Loading torrents...</div>
{:else if error}
	<div class="error">
		{error}
		<button onclick={loadTorrents}>Retry</button>
	</div>
{:else if sortedTorrents.length === 0}
	<p>No torrents added yet.</p>
{:else}
	{#each sortedTorrents as t (t.infoHash)}
		<div class="torrent">
			<strong>{t.name || t.infoHash}</strong>
			<div class="progress-bar">
				<div class="progress" style="width: {Math.round(t.downloadedPercent)}%"></div>
			</div>
			<small>{Math.round(t.downloadedPercent)}% - {(t.size / 1024 / 1024).toFixed(1) + ' MB'}</small>
			<small>{stateToString(t.state)}</small>
			<small>{convertingStateToString(t.convertingState)}</small>
		</div>
	{/each}
{/if}

<style>
    .add-form {
        margin-bottom: 1.5rem;
        display: flex;
        gap: 0.5rem;
    }

    input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    button {
        padding: 0.5rem 1rem;
        background: #ff3e00;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
    }

    button:hover {
        background: #4075a6;
    }

    .torrent {
        border: 1px solid #ddd;
        padding: 1rem;
        margin-bottom: 0.5rem;
        border-radius: 0.5rem;
    }

    .progress-bar {
        background: #eee;
        border-radius: 0.25rem;
        overflow: hidden;
        height: 1rem;
        margin: 0.5rem 0;
    }

    .progress {
        height: 100%;
        background: #4075a6;
        transition: width 0.3s ease;
    }

    small {
        display: block;
        color: #666;
    }
</style>
