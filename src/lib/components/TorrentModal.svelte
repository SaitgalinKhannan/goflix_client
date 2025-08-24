<script lang="ts">
	import type { Torrent } from '$lib/types/torrent';
	import { goto } from '$app/navigation';

	const { torrent, onClose } = $props<{ torrent: Torrent | null; onClose: () => void }>();

	function formatBytes(bytes: number, decimals = 2) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			onClose();
		}
	}

	function handleModalContentClick(event: Event) {
		event.stopPropagation();
	}

	function playVideo(filePath: string) {
		// Remove file extension and add /playlist.m3u8
		const pathWithoutExtension = filePath.replace(/\.[^/.]+$/, '');
		const playlistPath = `${pathWithoutExtension}/playlist.m3u8`;
		const encodedPath = encodeURIComponent(playlistPath);
		goto(`/player?path=${encodedPath}`);
	}
</script>

{#if torrent}
	<div
		class="modal-backdrop"
		onclick={onClose}
		onkeydown={handleKeyDown}
		role="button"
		tabindex="0"
	>
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="modal-content"
			role="dialog"
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			onclick={handleModalContentClick}
		>
			<button class="modal-close" onclick={onClose}>&times;</button>
			<h2>{torrent.name || 'Torrent Details'}</h2>
			<p><strong>InfoHash:</strong> {torrent.infoHash}</p>
			<p><strong>Size:</strong> {formatBytes(torrent.size)}</p>
			<p>
				<strong>Status:</strong>
				{torrent.done ? 'Completed' : 'Downloading'} ({torrent.downloadedPercent.toFixed(2)}%)
			</p>

			{#if torrent.videoFiles && torrent.videoFiles.length > 0}
				<h3>Video Files</h3>
				<ul>
					{#each torrent.videoFiles as file}
						<li>
							<div class="file-header">
								<strong>{file.path}</strong>
								<button class="play-btn" onclick={() => playVideo(file.path)}>Play</button>
							</div>
							{#if file.videoInfo}
								<ul>
									{#each file.videoInfo.streams as stream}
										<li>
											{stream.codec_type}: {stream.codec_name}
											{#if stream.codec_type === 'video'}
												({stream.width}x{stream.height})
											{:else if stream.codec_type === 'audio'}
												({stream.tags?.language})
											{/if}
										</li>
									{/each}
								</ul>
							{:else if file.error}
								<p class="error">Error: {file.error}</p>
							{:else}
								<p>No video info available.</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}
	.modal-content {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		max-width: 80%;
		max-height: 80%;
		overflow-y: auto;
		color: #333;
	}
	.modal-close {
		position: absolute;
		top: 10px;
		right: 10px;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
	}
	h2,
	h3 {
		color: #ff3e00;
	}
	ul {
		list-style-type: none;
		padding-left: 0;
	}
	li {
		margin-bottom: 0.5rem;
	}
	.file-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.play-btn {
		background: #ff3e00;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: bold;
		transition: background 0.2s;
	}
	.play-btn:hover {
		background: #ff5a2d;
	}
</style>