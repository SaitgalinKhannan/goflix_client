export const TORRENT_STATES = {
	DOWNLOADING: 'downloading',
	COMPLETED: 'completed',
	QUEUED: 'queued',
	CONVERTING: 'converting',
	CONVERTED: 'converted',
	ERROR: 'error'
} as const;

export const API_ENDPOINTS = {
	TORRENTS: '/api/torrents',
	TORRENT_BY_ID: (id: string) => `/api/torrents/${id}`,
	ADD_TORRENT: '/api/torrents/add',
	CONVERT_TORRENT: (id: string) => `/api/torrents/${id}/convert`,
	FILES: (path: string) => '/api/files?path=' + path,
	VIDEO: (path: string) => '/api/video?path=' + path
} as const;

export const DEFAULT_PAGINATION = {
	PAGE: 1,
	LIMIT: 20
} as const;