<script lang="ts">
	import VideoCard from '$lib/components/VideoCard.svelte';
	import type { Torrent } from '$lib/types/torrent';

	// Data is loaded in +page.ts
	let { data } = $props<{ data: { torrents: Torrent[] } }>();

	// Filter torrents that have video files (Svelte 5 runes)
	const torrents = $derived(
		data?.torrents?.filter((torrent: Torrent) => torrent.videoFiles && Array.isArray(torrent.videoFiles) && torrent.videoFiles.length > 0) ?? []
	);
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	{#if torrents.length > 0}
		{#each torrents as torrent (torrent.infoHash)}
			<div class="torrent-section">
				<h2 class="torrent-title">{torrent.name || torrent.infoHash}</h2>
				{#if torrent.videoFiles && torrent.videoFiles.length > 0}
					<div class="video-grid">
						{#each torrent.videoFiles as videoFile (videoFile.path)}
							<VideoCard {videoFile} torrentName={torrent.name || torrent.infoHash} />
						{/each}
					</div>
				{:else}
					<p>No video files found for this torrent.</p>
				{/if}
			</div>
		{/each}
	{:else}
		<p>No torrents with video files found. Add some torrents with video files to see them here.</p>
	{/if}
</section>

<style>
    section {
        padding: 1rem;
    }

    .video-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
    }

    p {
        text-align: center;
        color: #666;
        font-style: italic;
    }

    .torrent-section {
        margin-bottom: 2rem;
        padding: 1rem;
        border: 1px solid #eee;
        border-radius: 8px;
    }

    .torrent-title {
        color: #ff3e00;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #eee;
    }
</style>
