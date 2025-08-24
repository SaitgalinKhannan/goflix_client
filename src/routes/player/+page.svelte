<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Hls from 'hls.js';
	import { API_URL } from '$lib/config/api';
	import { API_ENDPOINTS } from '$lib/utils/constants';
	import { browser } from '$app/environment';

	let videoElement: HTMLVideoElement;
	let containerElement: HTMLDivElement;
	let hls: Hls | null = null;
	let isLoading = $state(true);
	let error: string | null = $state(null);
	let videoPath: string = $state('');
	let isClient = $state(false);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let buffered = $state(0);
	let isMuted = $state(false);
	let volume = $state(0.7);
	let isFullscreen = $state(false);
	let isPiPActive = $state(false);
	let showControls = $state(true);
	let controlsTimeout: number;
	let playbackRate = $state(1);
	let showSpeedMenu = $state(false);
	let showVolumeSlider = $state(false);

	const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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
				setupVideoEvents();
				setupKeyboardShortcuts();
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
			setupVideoEvents();
			setupKeyboardShortcuts();
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
		const hours = Math.floor(seconds / 3600);
		const min = Math.floor((seconds % 3600) / 60);
		const sec = Math.floor(seconds % 60);
		if (hours > 0) {
			return `${hours}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
		}
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
		if (!browser) return;
		if (!document.fullscreenElement) {
			containerElement?.requestFullscreen().catch(console.error);
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
		resetControlsTimer();
	};

	// Picture-in-Picture режим
	const togglePiP = async () => {
		if (!browser) return;
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
				isPiPActive = false;
			} else if (document.pictureInPictureEnabled) {
				await videoElement.requestPictureInPicture();
				isPiPActive = true;
			}
		} catch (error) {
			console.error('PiP error:', error);
		}
		resetControlsTimer();
	};

	// Перемотка вперед/назад
	const skip = (seconds: number) => {
		videoElement.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
		resetControlsTimer();

		// Показываем индикатор перемотки
		const indicator = seconds > 0 ? 'forward' : 'backward';
		showSkipIndicator(indicator, Math.abs(seconds));
	};

	// Показать индикатор перемотки
	let skipIndicatorTimeout: number;
	let skipIndicatorType = $state('');
	let skipIndicatorValue = $state(0);

	const showSkipIndicator = (type: string, value: number) => {
		skipIndicatorType = type;
		skipIndicatorValue = value;
		clearTimeout(skipIndicatorTimeout);
		skipIndicatorTimeout = setTimeout(() => {
			skipIndicatorType = '';
		}, 1000);
	};

	// Изменение скорости воспроизведения
	const changePlaybackRate = (rate: number) => {
		playbackRate = rate;
		videoElement.playbackRate = rate;
		showSpeedMenu = false;
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
		controlsTimeout = setTimeout(() => {
			showControls = false;
			showSpeedMenu = false;
			showVolumeSlider = false;
		}, 3000);
	};

	// Обработка клика по прогресс-бару
	const handleProgressClick = (e: MouseEvent) => {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const time = percent * duration;
		videoElement.currentTime = time;
		currentTime = time;
		resetControlsTimer();
	};

	// Обработчики событий видео
	const setupVideoEvents = () => {
		if (!videoElement) return;

		videoElement.ontimeupdate = () => {
			currentTime = videoElement.currentTime;
			duration = videoElement.duration || 0;

			// Обновляем буферизацию
			if (videoElement.buffered.length > 0) {
				const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
				buffered = (bufferedEnd / duration) * 100;
			}
		};

		videoElement.onplay = () => (isPlaying = true);
		videoElement.onpause = () => (isPlaying = false);
		videoElement.onvolumechange = () => {
			volume = videoElement.volume;
			isMuted = videoElement.muted;
		};

		videoElement.onclick = () => togglePlay();
		videoElement.ondblclick = () => toggleFullscreen();
		videoElement.onmousemove = resetControlsTimer;
		videoElement.ontouchstart = resetControlsTimer;

		// PiP события
		videoElement.addEventListener('enterpictureinpicture', () => {
			isPiPActive = true;
		});

		videoElement.addEventListener('leavepictureinpicture', () => {
			isPiPActive = false;
		});

		// Инициализация громкости
		videoElement.volume = volume;
	};

	// Горячие клавиши
	const setupKeyboardShortcuts = () => {
		if (!browser) return;
		const handleKeyPress = (e: KeyboardEvent) => {
			if (!videoElement) return;

			switch (e.key.toLowerCase()) {
				case ' ':
				case 'k':
					e.preventDefault();
					togglePlay();
					break;
				case 'arrowleft':
					e.preventDefault();
					skip(-10);
					break;
				case 'arrowright':
					e.preventDefault();
					skip(10);
					break;
				case 'j':
					e.preventDefault();
					skip(-10);
					break;
				case 'l':
					e.preventDefault();
					skip(10);
					break;
				case 'arrowup':
					e.preventDefault();
					volume = Math.min(1, volume + 0.1);
					videoElement.volume = volume;
					break;
				case 'arrowdown':
					e.preventDefault();
					volume = Math.max(0, volume - 0.1);
					videoElement.volume = volume;
					break;
				case 'm':
					e.preventDefault();
					toggleMute();
					break;
				case 'f':
					e.preventDefault();
					toggleFullscreen();
					break;
				case 'p':
					e.preventDefault();
					togglePiP();
					break;
				case '0':
				case '1':
				case '2':
				case '3':
				case '4':
				case '5':
				case '6':
				case '7':
				case '8':
				case '9': {
					e.preventDefault();
					const percent = parseInt(e.key) * 0.1;
					videoElement.currentTime = duration * percent;
					break;
				}
			}
		};

		document.addEventListener('keydown', handleKeyPress);

		onDestroy(() => {
			document.removeEventListener('keydown', handleKeyPress);
		});
	};

	onMount(() => {
		isClient = true;
		const params = new URLSearchParams(window.location.search);
		videoPath = decodeURIComponent(params.get('path') || '/');
		initPlayer();

		if (browser) {
			document.addEventListener('fullscreenchange', () => {
				isFullscreen = !!document.fullscreenElement;
			});
		}
	});
	onDestroy(() => {
		destroyPlayer();
		clearTimeout(skipIndicatorTimeout);
	});
</script>

<div class="player-wrapper">
	<div class="video-container" class:fullscreen={isFullscreen} bind:this={containerElement}>
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
			autoplay
			class="video-player"
			class:hidden={isLoading || error}
		>
			<track kind="captions" src="" />
			Ваш браузер не поддерживает воспроизведение видео.
		</video>

		<!-- Индикатор перемотки -->
		{#if skipIndicatorType}
			<div class="skip-indicator {skipIndicatorType}">
				<div class="skip-icon">
					{#if skipIndicatorType === 'forward'}
						<svg width="48" height="48" viewBox="0 0 24 24">
							<path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
						</svg>
					{:else}
						<svg width="48" height="48" viewBox="0 0 24 24">
							<path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
						</svg>
					{/if}
				</div>
				<div class="skip-text">{skipIndicatorValue} сек</div>
			</div>
		{/if}

		<!-- Кастомные элементы управления -->
		<div class="controls" class:visible={showControls && !isLoading && !error}
			 onmousemove={resetControlsTimer}
			 onmouseleave={() => {
			showSpeedMenu = false;
			showVolumeSlider = false;
		}}
			 role="toolbar"
			 aria-label="Элементы управления видео"
			 tabindex="0"
			 onkeydown={(e) => {
			// Handle keyboard navigation for toolbar
			if (e.key === 'Escape') {
				showSpeedMenu = false;
				showVolumeSlider = false;
			}
		}}
		>
			<!-- Градиент сверху для лучшей видимости -->
			<div class="controls-gradient-top"></div>

			<div class="progress-bar"
				 onclick={handleProgressClick}
				 role="slider"
				 aria-label="Прогресс воспроизведения"
				 aria-valuenow={currentTime}
				 aria-valuemin="0"
				 aria-valuemax={duration || 100}
				 tabindex="0"
				 onkeydown={(e) => {
				// Handle keyboard navigation for slider
				if (!duration) return;
				const step = duration * 0.05; // 5% of duration
				switch (e.key) {
					case 'ArrowLeft':
						e.preventDefault();
						videoElement.currentTime = Math.max(0, currentTime - step);
						break;
					case 'ArrowRight':
						e.preventDefault();
						videoElement.currentTime = Math.min(duration, currentTime + step);
						break;
					case 'Home':
						e.preventDefault();
						videoElement.currentTime = 0;
						break;
					case 'End':
						e.preventDefault();
						videoElement.currentTime = duration;
						break;
				}
			}}
			>
				<div class="progress-bg"></div>
				<div class="progress-buffered" style={`width: ${buffered}%`}></div>
				<div class="progress-filled" style={`width: ${Math.max(0.5, (currentTime / duration) * 100 || 0)}%`}>
					<div class="progress-thumb"></div>
				</div>
				<input
					type="range"
					min="0"
					max="100"
					step="0.1"
					value={(currentTime / duration) * 100 || 0}
					oninput={updateProgress}
					class="progress-input"
				/>
			</div>

			<div class="control-bar">
				<div class="controls-left">
					<button
						onclick={togglePlay}
						class="control-btn play-btn"
						aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
					>
						{#if isPlaying}
							<svg width="28" height="28" viewBox="0 0 24 24">
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</svg>
						{:else}
							<svg width="28" height="28" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>

					<!-- Кнопки перемотки -->
					<button
						onclick={() => skip(-10)}
						class="control-btn skip-btn"
						aria-label="Назад на 10 секунд"
					>
						<svg width="24" height="24" viewBox="0 0 24 24">
							<path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
						</svg>
					</button>

					<button
						onclick={() => skip(10)}
						class="control-btn skip-btn"
						aria-label="Вперед на 10 секунд"
					>
						<svg width="24" height="24" viewBox="0 0 24 24">
							<path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
						</svg>
					</button>

					<!-- Громкость -->
					<div class="volume-control"
						 onmouseenter={() => showVolumeSlider = true}
						 onmouseleave={() => showVolumeSlider = false}
						 role="toolbar"
						 aria-label="Громкость"
						 tabindex="0"
					>
						<button
							onclick={toggleMute}
							class="control-btn"
							aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
						>
							{#if isMuted || volume === 0}
								<svg width="24" height="24" viewBox="0 0 24 24">
									<path
										d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
								</svg>
							{:else if volume < 0.5}
								<svg width="24" height="24" viewBox="0 0 24 24">
									<path
										d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
								</svg>
							{:else}
								<svg width="24" height="24" viewBox="0 0 24 24">
									<path
										d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
								</svg>
							{/if}
						</button>
						<div class="volume-slider-container" class:show={showVolumeSlider}>
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								bind:value={volume}
								oninput={updateVolume}
								class="volume-slider"
							/>
							<div class="volume-value">{Math.round(volume * 100)}%</div>
						</div>
					</div>

					<div class="time">
						<span class="time-current">{formatTime(currentTime)}</span>
						<span class="time-separator">/</span>
						<span class="time-duration">{formatTime(duration)}</span>
					</div>
				</div>

				<div class="controls-right">
					<!-- Скорость воспроизведения -->
					<div class="speed-control" role="toolbar" aria-label="Скорость воспроизведения" tabindex="0">
						<button
							onclick={() => showSpeedMenu = !showSpeedMenu}
							class="control-btn"
							aria-label="Скорость воспроизведения"
						>
							<span class="speed-text">{playbackRate}x</span>
						</button>
						{#if showSpeedMenu}
							<div class="speed-menu">
								{#each playbackSpeeds as speed (speed)}
									<button
										class="speed-option"
										class:active={playbackRate === speed}
										onclick={() => changePlaybackRate(speed)}
									>
										{speed}x
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Picture-in-Picture -->
					{#if isClient && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled}
						<button
							onclick={togglePiP}
							class="control-btn"
							class:active={isPiPActive}
							aria-label="Picture-in-Picture"
						>
							<svg width="24" height="24" viewBox="0 0 24 24">
								<path
									d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" />
							</svg>
						</button>
					{/if}

					<!-- Полноэкранный режим -->
					<button
						onclick={toggleFullscreen}
						class="control-btn"
						aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
					>
						{#if isFullscreen}
							<svg width="24" height="24" viewBox="0 0 24 24">
								<path
									d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
							</svg>
						{:else}
							<svg width="24" height="24" viewBox="0 0 24 24">
								<path
									d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
    :global(:root) {
        --primary-color: #e50914;
        --primary-hover: #f40612;
        --control-bg: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
        --control-hover: rgba(255, 255, 255, 0.2);
        --progress-height: 6px;
        --progress-bg: rgba(255, 255, 255, 0.3);
        --progress-buffered: rgba(255, 255, 255, 0.2);
        --controls-height: 70px;
        --text-primary: #ffffff;
        --text-secondary: rgba(255, 255, 255, 0.7);
    }

    .player-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100%;
        flex-grow: 1;
        /* background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%); */
        padding: 20px;
    }

    .video-container {
        position: relative;
        width: 100%;
        max-width: 1400px;
        background: #000;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        aspect-ratio: 16/9;
        transition: all 0.3s ease;
    }

    .video-container.fullscreen {
        max-width: none;
        border-radius: 0;
        height: 100vh;
        width: 100vw;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999;
    }

    .video-player {
        width: 100%;
        height: 100%;
        display: block;
        cursor: pointer;
        background: #000;
    }

    .video-player.hidden {
        display: none;
    }

    /* Skip Indicator */
    .skip-indicator {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.8);
        border-radius: 50%;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        animation: fadeInOut 1s ease;
        pointer-events: none;
        z-index: 15;
    }

    .skip-indicator.forward {
        right: 20%;
    }

    .skip-indicator.backward {
        left: 20%;
    }

    .skip-icon svg {
        fill: white;
        opacity: 0.9;
    }

    .skip-text {
        color: white;
        font-size: 14px;
        font-weight: 600;
    }

    /* Controls */
    .controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--control-bg);
        padding: 20px 24px 16px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
    }

    .controls.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: all;
    }

    .controls-gradient-top {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100px;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent);
        pointer-events: none;
    }

    /* Progress Bar */
    .progress-bar {
        position: relative;
        height: var(--progress-height);
        margin-bottom: 16px;
        cursor: pointer;
        transition: height 0.2s ease;
    }

    .progress-bar:hover {
        height: 8px;
    }

    .progress-bg {
        position: absolute;
        width: 100%;
        height: 100%;
        background: var(--progress-bg);
        border-radius: 3px;
    }

    .progress-buffered {
        position: absolute;
        height: 100%;
        background: var(--progress-buffered);
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .progress-filled {
        position: absolute;
        height: 100%;
        background: var(--primary-color);
        border-radius: 3px;
        transition: width 0.1s linear;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-width: 7px; /* Минимальная ширина для отображения индикатора */
    }

    .progress-thumb {
        width: 14px;
        height: 14px;
        background: white;
        border-radius: 50%;
        margin-right: -7px;
        opacity: 0;
        transition: opacity 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        flex-shrink: 0; /* Предотвращаем сжатие индикатора */
    }

    .progress-bar:hover .progress-thumb {
        opacity: 1;
    }

    .progress-input {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        z-index: 10;
    }

    /* Control Bar */
    .control-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
    }

    .controls-left,
    .controls-right {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .control-btn {
        background: none;
        border: none;
        color: var(--text-primary);
        padding: 10px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 44px; /* Ensure button is square for perfect circle */
        height: 44px; /* Ensure button is square for perfect circle */
    }

    .control-btn:hover {
        background: var(--control-hover);
        transform: scale(1.1);
    }

    .control-btn.active {
        color: var(--primary-color);
    }

    .control-btn svg {
        fill: currentColor;
        width: 24px;
        height: 24px;
    }

    .play-btn svg {
        width: 32px;
        height: 32px;
    }

    .skip-btn {
        padding: 8px;
    }

    /* Volume Control */
    .volume-control {
        display: flex;
        align-items: center;
        position: relative;
    }

    .volume-slider-container {
        position: absolute;
        left: 100%;
        background: rgba(28, 28, 28, 0.95);
        border-radius: 8px;
        padding: 10px 15px;
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        z-index: 20;
    }

    .volume-slider-container.show {
        opacity: 1;
        pointer-events: all;
    }

    .volume-slider {
        width: 80px;
        height: 4px;
        background: var(--progress-bg);
        outline: none;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        border-radius: 2px;
    }

    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
    }

    .volume-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
        border: none;
    }

    .volume-value {
        color: var(--text-primary);
        font-size: 13px;
        min-width: 35px;
        font-weight: 500;
    }

    /* Time Display */
    .time {
        color: var(--text-primary);
        font-size: 14px;
        font-family: 'SF Mono', Monaco, monospace;
        display: flex;
        align-items: center;
        gap: 4px;
        user-select: none;
    }

    .time-separator {
        color: var(--text-secondary);
    }

    /* Speed Control */
    .speed-control {
        position: relative;
    }

    .speed-text {
        font-size: 14px;
        font-weight: 600;
        min-width: 35px;
        display: inline-block;
    }

    .speed-menu {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 10px;
        background: rgba(28, 28, 28, 0.95);
        border-radius: 8px;
        padding: 8px 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 80px;
        backdrop-filter: blur(10px);
    }

    .speed-option {
        display: block;
        width: 100%;
        padding: 8px 16px;
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
    }

    .speed-option:hover {
        background: var(--control-hover);
        color: var(--text-primary);
    }

    .speed-option.active {
        color: var(--primary-color);
        font-weight: 600;
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
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(10px);
    }

    .spinner {
        width: 60px;
        height: 60px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
    }

    .loading p,
    .error p {
        color: var(--text-primary);
        font-size: 16px;
        margin: 0;
    }

    .error {
        background: rgba(0, 0, 0, 0.95);
    }

    .error p {
        color: #ff6b6b;
        margin-bottom: 20px;
    }

    .error button {
        padding: 12px 28px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .error button:hover {
        background: var(--primary-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(229, 9, 20, 0.3);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .player-wrapper {
            padding: 0;
        }

        .video-container {
            border-radius: 0;
            max-width: none;
        }

        .controls {
            padding: 16px 20px 12px;
        }

        .control-bar {
            gap: 12px;
        }

        .skip-btn {
            display: none;
        }

        .volume-slider-container {
            display: none;
        }

        .speed-control {
            display: none;
        }

        .time {
            font-size: 12px;
        }
    }

    @media (max-width: 480px) {
        .controls {
            padding: 12px 16px 8px;
        }

        .controls-left,
        .controls-right {
            gap: 8px;
        }

        .control-btn {
            padding: 8px;
        }

        .play-btn svg {
            width: 28px;
            height: 28px;
        }
    }

    /* Animations */
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes fadeInOut {
        0% {
            opacity: 0;
            transform: translateY(-50%) scale(0.8);
        }
        20% {
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }
        80% {
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }
        100% {
            opacity: 0;
            transform: translateY(-50%) scale(0.8);
        }
    }
</style>
