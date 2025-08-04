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
	let isFullscreen = $state(false);
	let showControls = $state(true);
	let controlsTimeout: number;

	// Функция для создания URL для запроса к серверу
	const createVideoUrl = (path: string): string => {
		return API_URL + API_ENDPOINTS.VIDEO(encodeURIComponent(path));
	};

	const initPlayer = () => {
		if (!videoElement) return;

		// Проверяем поддержку HLS
		if (Hls.isSupported()) {
			hls = new Hls({
				xhrSetup: (xhr, url) => {
					const originalUrl = new URL(url);
					const pathname = originalUrl.pathname;
					if (pathname.includes('.ts')) {
						const segmentName = pathname.split('/').pop();
						const filmName = videoPath.replace('.m3u8', '');
						const segmentPath = `${filmName}/${segmentName}`;
						xhr.open('GET', createVideoUrl(segmentPath), true);
						return;
					}
					xhr.open('GET', url, true);
				},
				enableWorker: true,
				lowLatencyMode: false,
				backBufferLength: 90
			});

			const masterPlaylistUrl = createVideoUrl(videoPath);
			hls.loadSource(masterPlaylistUrl);
			hls.attachMedia(videoElement);

			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				console.log('Манифест загружен');
				isLoading = false;
			});

			hls.on(Hls.Events.ERROR, (event, data) => {
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

	const goBack = () => {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	};

	const toggleFullscreen = () => {
		const container = document.querySelector('.video-container') as HTMLElement;

		if (!document.fullscreenElement) {
			container.requestFullscreen().then(() => {
				isFullscreen = true;
			}).catch(() => {
				console.log('Fullscreen not supported');
			});
		} else {
			document.exitFullscreen().then(() => {
				isFullscreen = false;
			});
		}
	};

	const handleMouseMove = () => {
		showControls = true;
		clearTimeout(controlsTimeout);

		if (!isLoading && !error) {
			controlsTimeout = setTimeout(() => {
				if (!videoElement?.paused) {
					showControls = false;
				}
			}, 3000);
		}
	};

	const handleMouseLeave = () => {
		if (!videoElement?.paused && !isLoading && !error) {
			showControls = false;
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

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		videoPath = decodeURIComponent(params.get('path') || '/');
		initPlayer();

		// Слушаем изменения fullscreen
		document.addEventListener('fullscreenchange', () => {
			isFullscreen = !!document.fullscreenElement;
		});
	});

	onDestroy(() => {
		destroyPlayer();
		clearTimeout(controlsTimeout);
	});
</script>

<div
	class="video-container"
	class:fullscreen={isFullscreen}
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
>
	<!-- Кнопка назад -->
	<button
		class="back-button"
		class:show={showControls || isLoading || error}
		onclick={goBack}
		aria-label="Назад"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="m15 18-6-6 6-6"/>
		</svg>
		<span class="back-text">Назад</span>
	</button>

	<!-- Кнопка полноэкранного режима -->
	{#if !isLoading && !error}
		<button
			class="fullscreen-button"
			class:show={showControls}
			onclick={toggleFullscreen}
			aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
		>
			{#if isFullscreen}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
				</svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
				</svg>
			{/if}
		</button>
	{/if}

	<!-- Состояние загрузки -->
	{#if isLoading}
		<div class="loading">
			<div class="loading-content">
				<div class="spinner"></div>
				<p class="loading-text">Загружаем видео...</p>
				<div class="loading-bar">
					<div class="loading-progress"></div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Состояние ошибки -->
	{#if error}
		<div class="error">
			<div class="error-content">
				<div class="error-icon">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<line x1="15" y1="9" x2="9" y2="15"/>
						<line x1="9" y1="9" x2="15" y2="15"/>
					</svg>
				</div>
				<h3 class="error-title">Ошибка воспроизведения</h3>
				<p class="error-message">{error}</p>
				<button
					class="retry-button"
					onclick={() => {
						error = null;
						isLoading = true;
						initPlayer();
					}}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
						<path d="M21 3v5h-5"/>
						<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
						<path d="M3 21v-5h5"/>
					</svg>
					Попробовать снова
				</button>
			</div>
		</div>
	{/if}

	<!-- Видео плеер -->
	<video
		bind:this={videoElement}
		controls
		preload="metadata"
		class="video-player"
		class:hidden={isLoading || error}
		class:controls-visible={showControls}
	>
		<track kind="captions">
		Ваш браузер не поддерживает воспроизведение видео.
	</video>
</div>

<style>
    .video-container {
        position: relative;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
    }

    .video-container.fullscreen {
        max-width: none;
        border-radius: 0;
        box-shadow: none;
    }

    .video-player {
        width: 100%;
        height: auto;
        min-height: 300px;
        background-color: #000;
        border-radius: inherit;
        transition: all 0.3s ease;
    }

    .video-player.hidden {
        display: none;
    }

    /* Кнопка назад */
    .back-button {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(-10px);
        pointer-events: none;
    }

    .back-button.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    .back-button:hover {
        background: rgba(0, 0, 0, 0.9);
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }

    .back-text {
        display: inline;
    }

    /* Кнопка полноэкранного режима */
    .fullscreen-button {
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 1000;
        padding: 12px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(-10px);
        pointer-events: none;
    }

    .fullscreen-button.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    .fullscreen-button:hover {
        background: rgba(0, 0, 0, 0.9);
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }

    /* Состояние загрузки */
    .loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 100;
    }

    .loading-content {
        text-align: center;
        color: white;
        max-width: 300px;
        padding: 40px 20px;
    }

    .spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid #ffffff;
        border-radius: 50%;
        animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        margin: 0 auto 24px;
    }

    .loading-text {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 24px;
        opacity: 0.9;
    }

    .loading-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
    }

    .loading-progress {
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
        animation: loading-shimmer 1.5s infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @keyframes loading-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }

    /* Состояние ошибки */
    .error {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
        z-index: 100;
    }

    .error-content {
        text-align: center;
        color: white;
        max-width: 400px;
        padding: 40px 20px;
    }

    .error-icon {
        margin: 0 auto 24px;
        opacity: 0.9;
    }

    .error-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 12px;
        line-height: 1.2;
    }

    .error-message {
        font-size: 16px;
        margin-bottom: 32px;
        opacity: 0.9;
        line-height: 1.5;
    }

    .retry-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 28px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .retry-button:hover {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    }

    /* Адаптивность */
    @media (max-width: 768px) {
        .video-container {
            margin: 10px;
            border-radius: 12px;
        }

        .back-button {
            top: 15px;
            left: 15px;
            padding: 10px 12px;
            font-size: 13px;
        }

        .back-text {
            display: none;
        }

        .fullscreen-button {
            top: 15px;
            right: 15px;
            padding: 10px;
        }

        .loading-content {
            padding: 30px 15px;
        }

        .loading-text {
            font-size: 16px;
        }

        .error-content {
            padding: 30px 15px;
        }

        .error-title {
            font-size: 20px;
        }

        .error-message {
            font-size: 14px;
        }

        .retry-button {
            padding: 12px 24px;
            font-size: 14px;
        }
    }

    @media (max-width: 480px) {
        .video-container {
            margin: 5px;
            border-radius: 8px;
        }

        .video-player {
            min-height: 200px;
        }

        .back-button {
            top: 12px;
            left: 12px;
            padding: 8px 10px;
        }

        .fullscreen-button {
            top: 12px;
            right: 12px;
            padding: 8px;
        }

        .spinner {
            width: 50px;
            height: 50px;
        }

        .error-title {
            font-size: 18px;
        }
    }

    /* Скрытие контролов в полноэкранном режиме */
    .video-container.fullscreen .back-button:not(.show),
    .video-container.fullscreen .fullscreen-button:not(.show) {
        opacity: 0;
        pointer-events: none;
    }

    /* Плавные переходы для контролов */
    .back-button,
    .fullscreen-button {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
</style>