export const TORRENT_STATES = {
	DOWNLOADING: 0,
	QUEUED: 1,
	COMPLETED: 2,
	PAUSED: 3
} as const;

export const CONVERTING_STATES = {
	NOT_CONVERTED: 0,
	CONVERTING_QUEUED: 1,
	CONVERTING: 2,
	CONVERTED: 3,
	CONVERTING_ERROR: 4
} as const;

export const API_ENDPOINTS = {
	TORRENTS: '/api/torrents',
	TORRENT_BY_HASH: (hash: string) => `/api/torrents/${hash}`,
	ADD_TORRENT: '/api/torrents',
	GET_TORRENT: (hash: string) => `/api/torrents/${hash}`,
	CONVERT_TORRENT: (hash: string) => `/api/torrents/${hash}/convert`,
	PAUSE_TORRENT: (hash: string) => `/api/torrents/${hash}/pause`,
	RESUME_TORRENT: (hash: string) => `/api/torrents/${hash}/resume`,
	// ИСПРАВЛЕНО: убран /delete в конце
	DELETE_TORRENT: (hash: string) => `/api/torrents/${hash}`,
	FILES: (path: string) => '/api/files?path=' + path,
	VIDEO: (path: string) => '/api/video?path=' + path
} as const;

export const DEFAULT_PAGINATION = {
	PAGE: 1,
	LIMIT: 20
} as const;