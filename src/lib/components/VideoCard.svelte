<svelte:options runes={true} />
<script lang="ts">
	import { goto } from '$app/navigation';
	import type { VideoFile, Stream } from '$lib/types/torrent';

	const props = $props<{ videoFile: VideoFile; torrentName?: string }>();
	const videoFile = $derived(props.videoFile);
	const torrentName = $derived(props.torrentName ?? '');

	// Extract filename from path and remove extension
	const fileName = $derived(
		(videoFile.path.split('/').pop() || videoFile.path).replace(/\.[^/.]+$/, '')
	);

	// Get video info if available
	const videoInfo = $derived(videoFile.videoInfo);
	const duration = $derived(
		videoInfo?.format?.duration ? formatDuration(videoInfo.format.duration) : 'Unknown'
	);

	function formatDuration(secondsStr: string): string {
		const seconds = parseFloat(secondsStr);
		if (isNaN(seconds)) return 'Unknown';
		
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		} else {
			return `${minutes}:${secs.toString().padStart(2, '0')}`;
		}
	}

	function playVideo() {
		const filePath = videoFile.path;
		// Remove file extension and add /playlist.m3u8
		const pathWithoutExtension = filePath.replace(/\.[^/.]+$/, '');
		const playlistPath = `${pathWithoutExtension}/playlist.m3u8`;
		const encodedPath = encodeURIComponent(playlistPath);
		goto(`/player?path=${encodedPath}`);
	}

	function handleKeydown(event: KeyboardEvent) {
		// Handle Enter and Space keys to trigger the playVideo function
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			playVideo();
		}
	}
</script>

<div class="video-card" role="button" tabindex="0" onclick={playVideo} onkeydown={handleKeydown}>
	<div class="video-thumbnail">
		{#if videoInfo?.streams?.some((stream: Stream) => stream.codec_type === 'video')}
			<div class="thumbnail-placeholder">
				<span class="play-icon">▶</span>
			</div>
		{:else}
			<div class="thumbnail-placeholder no-video">
				<span class="file-icon">📄</span>
			</div>
		{/if}
	</div>
	<div class="video-info">
		<h3 class="video-title" title={fileName}>{fileName}</h3>
		<p class="video-meta">
			{#if videoInfo}
				<span class="duration">{duration}</span>
				{#if videoInfo.format?.size}
					<span class="size">{(parseInt(videoInfo.format.size) / (1024 * 1024)).toFixed(1)} MB</span>
				{/if}
			{:else if videoFile.error}
				<span class="error">Error: {videoFile.error}</span>
			{:else}
				<span class="processing">Processing...</span>
			{/if}
		</p>
		{#if torrentName}
			<p class="torrent-name" title={torrentName}>{torrentName}</p>
		{/if}
	</div>
</div>

<style>
	.video-card {
		display: flex;
		flex-direction: column;
		border: 1px solid #ddd;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		transition: all 0.2s ease;
		background: white;
	}

	.video-card:hover {
		border-color: #ff3e00;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.video-thumbnail {
		position: relative;
		width: 100%;
		padding-top: 56.25%; /* 16:9 Aspect Ratio */
		background: #f5f5f5;
	}

	.thumbnail-placeholder {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #e0e0e0;
	}

	.thumbnail-placeholder.no-video {
		background: #f0f0f0;
	}

	.play-icon {
		font-size: 2rem;
		color: #ff3e00;
	}

	.file-icon {
		font-size: 2rem;
		color: #666;
	}

	.video-info {
		padding: 0.75rem;
	}

	.video-title {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.video-meta {
		margin: 0 0 0.25rem 0;
		font-size: 0.8rem;
		color: #666;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.duration, .size, .error, .processing {
		background: #f0f0f0;
		padding: 0.125rem 0.25rem;
		border-radius: 4px;
	}

	.error {
		background: #ffebee;
		color: #c62828;
	}

	.processing {
		background: #e3f2fd;
		color: #1565c0;
	}

	.torrent-name {
		margin: 0;
		font-size: 0.75rem;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>