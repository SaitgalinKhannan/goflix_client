<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { API_URL } from '$lib/config/api';
	import { API_ENDPOINTS, TORRENT_STATES } from '$lib/utils/constants';
	import type { Torrent } from '$lib/types/torrent';
	import { convertingStateToString, stateToString } from '$lib/utils/mappers';
	import { getWebSocketContext } from '$lib/context/websocket';
	import { notifications } from '$lib/stores/notificationStore';
	import { page } from '$app/state';
	import TorrentModal from '$lib/components/TorrentModal.svelte';

	const { data } = $props<{ data: { torrents: Torrent[] } }>();
	let magnet: string = $state('');
	let torrents: Torrent[] = $state(data.torrents ?? []);
	let isLoading: boolean = $state(false);
	let error: string | null = $state(null);
	let processingTorrents: Set<string> = $state(new Set());
	let selectedTorrent: Torrent | null = $state(null);

	function showTorrentDetails(torrent: Torrent) {
		selectedTorrent = torrent;
	}

	function closeTorrentDetails() {
		selectedTorrent = null;
	}

	const wsStore = getWebSocketContext();
	const unsubscribe = wsStore.subscribe((newTorrents) => {
		if (page.url.hostname !== '/torrent') return;
		const oldTorrents = new Map(torrents.map((t) => [t.infoHash, t]));
		const currentTorrentsMap = new Map(newTorrents.map((t) => [t.infoHash, t]));

		// Detect new torrents and state changes
		newTorrents.forEach((newTorrent) => {
			const oldTorrent = oldTorrents.get(newTorrent.infoHash);

			if (!oldTorrent) {
				// New torrent added
				notifications.add(
					`Torrent "${newTorrent.name || newTorrent.infoHash}" has been added.`,
					'info',
					'Torrent Added'
				);
			} else {
				// Check for download completion
				if (oldTorrent.downloadedPercent < 100 && newTorrent.downloadedPercent === 100) {
					notifications.add(
						`Torrent "${newTorrent.name || newTorrent.infoHash}" has finished downloading!`,
						'success',
						'Download Complete'
					);
				}

				// Check for state changes
				if (oldTorrent.state !== newTorrent.state) {
					notifications.add(
						`Torrent "${newTorrent.name || newTorrent.infoHash}" state changed to ${stateToString(newTorrent.state)}.`,
						'info',
						'Torrent State Changed'
					);
				}

				// Check for converting state changes
				if (oldTorrent.convertingState !== newTorrent.convertingState) {
					if (newTorrent.convertingState) {
						notifications.add(
							`Torrent "${newTorrent.name || newTorrent.infoHash}" is now ${convertingStateToString(newTorrent.convertingState)}.`,
							'info',
							'Torrent Converting'
						);
					} else if (oldTorrent.convertingState) {
						notifications.add(
							`Torrent "${newTorrent.name || newTorrent.infoHash}" finished converting.`,
							'success',
							'Conversion Complete'
						);
					}
				}
			}
		});

		// Detect deleted torrents
		torrents.forEach((oldTorrent) => {
			if (!currentTorrentsMap.has(oldTorrent.infoHash)) {
				notifications.add(
					`Torrent "${oldTorrent.name || oldTorrent.infoHash}" has been removed.`,
					'info',
					'Torrent Removed'
				);
			}
		});

		torrents = newTorrents;
	});

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
			notifications.add(error, 'error', 'Error loading torrents');
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
				const errorMessage = `HTTP error! status: ${response.status}`;
				console.error(errorMessage);
				notifications.add(errorMessage, 'error', 'Failed to add torrent');
			}
			// Очистка поля ввода после успешной отправки
			magnet = '';
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to add torrent:', error);
			notifications.add(`Failed to add torrent: ${errorMessage}`, 'error', 'Failed to add torrent');
		}
	}

	// Пауза торрента
	async function pauseTorrent(hash: string) {
		processingTorrents.add(hash);
		try {
			const response = await fetch(API_URL + API_ENDPOINTS.PAUSE_TORRENT(hash), {
				method: 'GET'
			});
			if (!response.ok) {
				throw new Error(`Failed to pause torrent: ${response.status}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to pause torrent:', error);
			notifications.add(`Failed to pause torrent: ${errorMessage}`, 'error', 'Pause Failed');
		} finally {
			processingTorrents.delete(hash);
		}
	}

	// Возобновление торрента
	async function resumeTorrent(hash: string) {
		processingTorrents.add(hash);
		try {
			const response = await fetch(API_URL + API_ENDPOINTS.RESUME_TORRENT(hash), {
				method: 'GET'
			});
			if (!response.ok) {
				throw new Error(`Failed to resume torrent: ${response.status}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to resume torrent:', error);
			notifications.add(`Failed to resume torrent: ${errorMessage}`, 'error', 'Resume Failed');
		} finally {
			processingTorrents.delete(hash);
		}
	}

	// Удаление торрента
	async function deleteTorrent(hash: string) {
		if (!confirm('Are you sure you want to delete this torrent?')) {
			return;
		}

		processingTorrents.add(hash);
		try {
			const response = await fetch(API_URL + API_ENDPOINTS.DELETE_TORRENT(hash), {
				method: 'DELETE'
			});
			if (!response.ok) {
				throw new Error(`Failed to delete torrent: ${response.status}`);
			}
			// Удаляем торрент из локального списка
			torrents = torrents.filter((t) => t.infoHash !== hash);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to delete torrent:', error);
			notifications.add(`Failed to delete torrent: ${errorMessage}`, 'error', 'Delete Failed');
		} finally {
			processingTorrents.delete(hash);
		}
	}

	// Конвертация торрента
	async function convertTorrent(hash: string) {
		processingTorrents.add(hash);
		try {
			const response = await fetch(API_URL + API_ENDPOINTS.CONVERT_TORRENT(hash), {
				method: 'POST'
			});
			if (!response.ok) {
				throw new Error(`Failed to convert torrent: ${response.status}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Failed to convert torrent:', error);
			notifications.add(`Failed to convert torrent: ${errorMessage}`, 'error', 'Convert Failed');
		} finally {
			processingTorrents.delete(hash);
		}
	}

	onMount(() => {
		// Данные уже пришли через load (SSR/прелоад).
		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		unsubscribe();
	});


	// Handle keyboard events for torrent items
	function handleTorrentKeydown(event: KeyboardEvent, torrent: Torrent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			showTorrentDetails(torrent);
		}
	}
</script>

<svelte:head>
	<title>Torrent</title>
	<meta name="description" content="Torrent client" />
</svelte:head>

<div class="add-form">
	<button onclick={() => (window.location.href = '/')}>Back</button>
	<input type="text" placeholder="Enter magnet link" bind:value={magnet} />
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
		<div
			class="torrent"
			role="button"
			tabindex="0"
			onclick={() => showTorrentDetails(t)}
			onkeydown={(e) => handleTorrentKeydown(e, t)}
		>
			<div class="torrent-header">
				<strong>{t.name || t.infoHash}</strong>
			</div>

			<div class="progress-bar">
				<div class="progress" style="width: {Math.round(t.downloadedPercent)}%"></div>
			</div>

			<div class="torrent-info">
				<small
				>{t.downloadedPercent.toFixed(2)}% - {(t.size / 1024 / 1024).toFixed(1) + ' MB'}</small
				>
				<small>{stateToString(t.state)}</small>
				{#if t.convertingState}
					<small>{convertingStateToString(t.convertingState)}</small>
				{/if}
			</div>

			<div class="torrent-controls">
				{#if processingTorrents.has(t.infoHash)}
					<button disabled class="btn-disabled">Processing...</button>
				{:else}
					{#if t.state === TORRENT_STATES.DOWNLOADING}
						<button onclick={() => pauseTorrent(t.infoHash)} class="btn-pause"> Pause</button>
					{:else if t.downloadedPercent !== 100}
						<button onclick={() => resumeTorrent(t.infoHash)} class="btn-resume"> Resume</button>
					{/if}

					{#if t.downloadedPercent === 100 && !t.convertingState}
						<button onclick={() => convertTorrent(t.infoHash)} class="btn-convert">
							Convert
						</button>
					{/if}

					<button onclick={() => deleteTorrent(t.infoHash)} class="btn-delete"> Delete</button>
				{/if}
			</div>
		</div>
	{/each}
{/if}

<TorrentModal torrent={selectedTorrent} onClose={closeTorrentDetails} />

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

    button:disabled,
    .btn-disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .torrent {
        border: 1px solid #ddd;
        padding: 1rem;
        margin-bottom: 0.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
    }

    .torrent:hover,
    .torrent:focus {
        border-color: #ff3e00;
        outline: 2px solid #ff3e00;
        outline-offset: 2px;
    }

    .torrent-header {
        margin-bottom: 0.5rem;
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

    .torrent-info {
        margin: 0.5rem 0;
    }

    small {
        display: block;
        color: #666;
        margin: 0.25rem 0;
    }

    .torrent-controls {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        flex-wrap: wrap;
    }

    .torrent-controls button {
        padding: 0.4rem 0.8rem;
        font-size: 0.9rem;
    }

    .btn-pause {
        background: #ff9800;
    }

    .btn-pause:hover {
        background: #f57c00;
    }

    .btn-resume {
        background: #4caf50;
    }

    .btn-resume:hover {
        background: #388e3c;
    }

    .btn-convert {
        background: #2196f3;
    }

    .btn-convert:hover {
        background: #1976d2;
    }

    .btn-delete {
        background: #f44336;
    }

    .btn-delete:hover {
        background: #d32f2f;
    }

    .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
    }

    .error {
        background: #ffebee;
        color: #c62828;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .error button {
        margin-top: 0.5rem;
        background: #c62828;
    }
</style>
