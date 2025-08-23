<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Hls from 'hls.js';
	import { API_URL } from '$lib/config/api';
	import { API_ENDPOINTS } from '$lib/utils/constants';

	let videoElement: HTMLVideoElement;
	let hls: Hls | null = null;
	let isLoading = $state(true);
	let error: string | null = $state(null);
	let videoPath: string = $state('');
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let isMuted = $state(false);
	let volume = $state(0.7);
	let isFullscreen = $state(false);
	let showControls = $state(true);
	let controlsTimeout: number;

	// Функция для создания URL для запроса к серверу
	const createVideoUrl = (path: string): string => {
		return API_URL + API_ENDPOINTS.VIDEO(path);
	};

	const initPlayer = () => {
		if (!videoElement) return;
		// Проверяем поддержку HLS
		if (Hls.isSupported()) {
			hls = new Hls({
				// Конфигурация для работы с вашим сервером
				xhrSetup: (xhr, url) => {
					// Модифицируем URL для сегментов
					const originalUrl = new URL(url);
					const pathname = originalUrl.pathname;
					// Если это запрос сегмента (содержит .ts), то добавляем папку фильма
					if (pathname.includes('.mp4') || pathname.includes('.m4s') || pathname.includes('.ts')) {
						const segmentName = pathname.split('/').pop();
						const filmName = videoPath.replace('/playlist.m3u8', '');
						const segmentPath = `${filmName}/${segmentName}`;
						// Заменяем URL на наш API endpoint
						xhr.open('GET', createVideoUrl(segmentPath), true);
						return;
					}
					// Для m3u8 файлов используем обычный запрос
					xhr.open('GET', url, true);
				},
				// Дополнительные настройки
				enableWorker: true,
				lowLatencyMode: false,
				backBufferLength: 90,
				manifestLoadingMaxRetry: 3,
				fragLoadingMaxRetry: 3
			});
			// Загружаем основной m3u8 файл
			const masterPlaylistUrl = createVideoUrl(videoPath);
			hls.loadSource(masterPlaylistUrl);
			hls.attachMedia(videoElement);
			// Обработчики событий
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				console.log('Манифест загружен');
				isLoading = false;
				setupVideoEvents(); // Добавляем установку обработчиков
				setTimeout(() => (showControls = false), 3000);
			});
			hls.on(Hls.Events.ERROR, (_, data) => {
				console.error('HLS ошибка:', data);
				if (data.fatal) {
					switch (data.type) {
						case Hls.ErrorTypes.NETWORK_ERROR:
							error = 'Ошибка сети при загрузке видео';
							hls?.startLoad();
							break;
						case Hls.ErrorTypes.MEDIA_ERROR:
							error = 'Ошибка медиа';
							hls?.recoverMediaError();
							break;
						default:
							error = 'Критическая ошибка плеера';
							hls?.destroy();
							break;
					}
					isLoading = false;
				}
			});
		} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
			// Нативная поддержка HLS (Safari)
			videoElement.src = createVideoUrl(videoPath);
			isLoading = false;
		} else {
			error = 'HLS не поддерживается в этом браузере';
			isLoading = false;
		}
	};

	const destroyPlayer = () => {
		if (hls) {
			hls.destroy();
			hls = null;
		}
	};

	// Переинициализация при изменении пути к видео
	$effect(() => {
		if (videoPath && videoElement) {
			error = null;
			isLoading = true;
			initPlayer();
			return () => {
				destroyPlayer();
			};
		}
	});

	// Форматирование времени
	const formatTime = (seconds: number): string => {
		const min = Math.floor(seconds / 60);
		const sec = Math.floor(seconds % 60);
		return `${min}:${sec < 10 ? '0' : ''}${sec}`;
	};

	// Переключение воспроизведения
	const togglePlay = () => {
		if (isPlaying) {
			videoElement.pause();
		} else {
			videoElement.play().catch((e) => console.error('Play error:', e));
		}
		isPlaying = !isPlaying;
		resetControlsTimer();
	};

	// Переключение звука
	const toggleMute = () => {
		isMuted = !isMuted;
		videoElement.muted = isMuted;
		resetControlsTimer();
	};

	// Переключение полноэкранного режима
	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			videoElement.parentElement?.requestFullscreen().catch(console.error);
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
		resetControlsTimer();
	};

	// Обновление позиции видео
	const updateProgress = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const time = (parseFloat(target.value) / 100) * duration;
		videoElement.currentTime = time;
		currentTime = time;
		resetControlsTimer();
	};

	// Обновление громкости
	const updateVolume = (e: Event) => {
		const target = e.target as HTMLInputElement;
		volume = parseFloat(target.value);
		videoElement.volume = volume;
		resetControlsTimer();
	};

	// Сброс таймера скрытия контролов
	const resetControlsTimer = () => {
		showControls = true;
		clearTimeout(controlsTimeout);
		controlsTimeout = setTimeout(() => (showControls = false), 3000);
	};

	// Обработчики событий видео
	const setupVideoEvents = () => {
		if (!videoElement) return;

		videoElement.ontimeupdate = () => {
			currentTime = videoElement.currentTime;
			duration = videoElement.duration || 0;
		};

		videoElement.onplay = () => (isPlaying = true);
		videoElement.onpause = () => (isPlaying = false);
		videoElement.onvolumechange = () => {
			volume = videoElement.volume;
			isMuted = videoElement.muted;
		};

		videoElement.onclick = () => togglePlay();
		videoElement.onmousemove = resetControlsTimer;
		videoElement.ontouchstart = resetControlsTimer;

		// Инициализация громкости
		videoElement.volume = volume;
	};

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		videoPath = decodeURIComponent(params.get('path') || '/');
		initPlayer();

		document.addEventListener('fullscreenchange', () => {
			isFullscreen = !!document.fullscreenElement;
		});
	});
	onDestroy(() => {
		destroyPlayer();
	});
</script>

<div class="video-container" class:fullscreen={isFullscreen}>
	{#if isLoading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка видео...</p>
		</div>
	{/if}

	{#if error}
		<div class="error">
			<p>{error}</p>
			<button
				onclick={() => {
					error = null;
					isLoading = true;
					initPlayer();
				}}
			>
				Попробовать снова
			</button>
		</div>
	{/if}

	<video
		bind:this={videoElement}
		preload="metadata"
		class="video-player"
		class:hidden={isLoading || error}
	>
		<track kind="captions" />
		Ваш браузер не поддерживает воспроизведение видео.
	</video>

	<!-- Кастомные элементы управления -->
	<div class="controls" class:visible={showControls && !isLoading && !error}>
		<div class="progress-bar">
			<input
				type="range"
				min="0"
				max="100"
				step="0.1"
				value={(currentTime / duration) * 100 || 0}
				oninput={updateProgress}
				class="progress"
			/>
			<div class="progress-filled" style={`width: ${(currentTime / duration) * 100 || 0}%`}></div>
		</div>

		<div class="control-bar">
			<button
				onclick={togglePlay}
				class="control-btn"
				aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
			>
				{#if isPlaying}
					<svg width="24" height="24" viewBox="0 0 24 24">
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
				{/if}
			</button>

			<div class="time">
				{formatTime(currentTime)} / {formatTime(duration)}
			</div>

			<div class="volume-control">
				<button
					onclick={toggleMute}
					class="control-btn"
					aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
				>
					{#if isMuted || volume === 0}
						<svg width="24" height="24" viewBox="0 0 24 24">
							<path
								d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
							/>
						</svg>
					{:else if volume < 0.5}
						<svg width="24" height="24" viewBox="0 0 24 24">
							<path
								d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"
							/>
						</svg>
					{:else}
						<svg width="24" height="24" viewBox="0 0 24 24">
							<path
								d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
							/>
						</svg>
					{/if}
				</button>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					bind:value={volume}
					oninput={updateVolume}
					class="volume-slider"
				/>
			</div>

			<button
				onclick={toggleFullscreen}
				class="control-btn fullscreen-btn"
				aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
			>
				{#if isFullscreen}
					<svg width="24" height="24" viewBox="0 0 24 24">
						<path
							d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
						/>
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24">
						<path
							d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
						/>
					</svg>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	:global(:root) {
		--primary-color: #ff3e00;
		--control-bg: rgba(0, 0, 0, 0.7);
		--control-hover: rgba(255, 255, 255, 0.1);
		--progress-height: 4px;
		--progress-bg: rgba(255, 255, 255, 0.2);
		--controls-height: 60px;
	}

	.video-container {
		position: relative;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		background: #000;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		aspect-ratio: 16/9;
	}

	.video-container.fullscreen {
		max-width: none;
		border-radius: 0;
		height: 100vh;
	}

	.video-player {
		width: 100%;
		height: 100%;
		display: block;
		cursor: pointer;
	}

	.video-player.hidden {
		display: none;
	}

	/* Контролы */
	.controls {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, var(--control-bg));
		padding: 12px 16px;
		transition: opacity 0.3s ease;
		opacity: 0;
		pointer-events: none;
	}

	.controls.visible {
		opacity: 1;
		pointer-events: all;
	}

	.progress-bar {
		position: relative;
		height: var(--progress-height);
		margin-bottom: 10px;
		cursor: pointer;
	}

	.progress {
		position: absolute;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		z-index: 10;
	}

	.progress-filled {
		position: absolute;
		height: 100%;
		background: var(--primary-color);
		border-radius: 2px;
		transition: width 0.1s linear;
	}

	.progress-bar::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 100%;
		background: var(--progress-bg);
		border-radius: 2px;
	}

	.control-bar {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.control-btn {
		background: none;
		border: none;
		color: white;
		padding: 8px;
		border-radius: 50%;
		cursor: pointer;
		transition: background 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.control-btn:hover,
	.control-btn:focus {
		background: var(--control-hover);
	}

	.control-btn svg {
		fill: currentColor;
		width: 24px;
		height: 24px;
	}

	.time {
		color: white;
		font-size: 14px;
		min-width: 100px;
		text-align: center;
		font-family: monospace;
	}

	.volume-control {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.volume-slider {
		width: 100px;
		height: 4px;
		opacity: 0;
		transition: opacity 0.2s;
		cursor: pointer;
		color: var(--primary-color);
	}

	.volume-control:hover .volume-slider {
		opacity: 1;
	}

	/* Loading & Error States */
	.loading,
	.error {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 20;
		background: rgba(0, 0, 0, 0.8);
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-top: 4px solid var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	.error {
		background: rgba(0, 0, 0, 0.9);
		color: #ff6b6b;
	}

	.error button {
		margin-top: 20px;
		padding: 10px 24px;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 30px;
		cursor: pointer;
		font-weight: 600;
		transition: background 0.2s;
	}

	.error button:hover {
		background: #ff3e00;
	}

	/* Адаптивность */
	@media (max-width: 768px) {
		.video-container {
			border-radius: 0;
		}

		.controls {
			padding: 8px 12px;
		}

		.volume-slider {
			width: 70px;
		}

		.time {
			min-width: 80px;
			font-size: 13px;
		}
	}

	@media (max-width: 480px) {
		.volume-slider {
			display: none;
		}

		.time {
			min-width: 70px;
		}
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
