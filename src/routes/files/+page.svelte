<script lang="ts">
	import { API_URL } from '$lib/config/api';

	interface File {
		name: string;
		path: string;
		isDir: boolean;
		size?: number;
		children?: File[];
	}

	let currentPath = $state('/');
	let files: File[] = $state([]);
	let isLoading: boolean = $state(true);
	let error: string | null = $state(null);

	// Загрузка существующих торрентов при инициализации
	async function loadFiles() {
		try {
			isLoading = true;
			error = null;

			const response = await fetch(`${API_URL}/api/files?path=${currentPath}`);

			if (!response.ok) {
				console.error(`Failed to load files: ${response.status}`);
				alert(`Failed to load files: ${response.status}`);
			}

			const data = await response.json();
			if (Array.isArray(data)) {
				files = data as File[];
			} else {
				console.error('Invalid response format from server', data);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
			console.error('Error loading files:', err);
		} finally {
			isLoading = false;
		}
	}

	// Функция для нормализации пути
	function normalizePath(path: string): string {
		if (!path || path === '/') return '/';

		// Убираем множественные слеши и нормализуем
		const normalized = path.replace(/\/+/g, '/');

		// Убеждаемся что путь начинается с / и не заканчивается на / (кроме корня)
		const withLeadingSlash = normalized.startsWith('/') ? normalized : '/' + normalized;
		return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
			? withLeadingSlash.slice(0, -1)
			: withLeadingSlash;
	}

	function goBack() {
		if (currentPath === '/') return;

		const parts = currentPath.split('/').filter(Boolean);
		parts.pop();

		// Если частей больше нет, возвращаемся в корень
		if (parts.length === 0) {
			currentPath = '/';
		} else {
			currentPath = '/' + parts.join('/');
		}
	}

	function navigateToFolder(folderPath: string) {
		currentPath = normalizePath(folderPath);
	}

	$effect(() => {
		loadFiles();
	});
</script>

<svelte:head>
	<title>Files</title>
	<meta name="description" content="Filest" />
</svelte:head>

<div>
	<button onclick={goBack}>Назад</button>
</div>

{#if isLoading}
	<p>Загрузка...</p>
{:else if error}
	<div class="error">
		{error}
		<button onclick={loadFiles}>Retry</button>
	</div>
{:else if files.length === 0}
	<p>There are no files here.</p>
{:else}
	<div class="files">
		{#each files as file (file.name)}
			<button
				class="file-card"
				class:folder={file.isDir}
				onclick={() => {
					if (file.isDir) {
						navigateToFolder(file.path);
					}
				}}
			>
				{#if file.isDir}
					📁 {file.name}
				{:else}
					📄 {file.name}
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
    .files {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
    }

    .file-card {
        border: 1px solid #ddd;
        padding: 1rem;
        border-radius: 0.5rem;
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        word-break: break-all;
    }

    .file-card.folder {
        cursor: pointer;
    }

    button {
        padding: 0.5rem 1rem;
        background: #ff3e00;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
    }

    button:hover {
        background: #4075a6;
    }
</style>