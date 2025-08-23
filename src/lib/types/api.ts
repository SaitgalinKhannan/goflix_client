export interface TorrentApiResponse {
	info_hash: string;
	name: string;
	magnet: string;
	size: number;
	done: boolean;
	state: number; // State как число с бэкенда
	completed_at?: string; // ISO строка
	queued_at?: string;
	converted_at?: string;
	last_checked: string;
	downloaded_percent: number;
}

export interface TorrentListApiResponse {
	torrents: TorrentApiResponse[];
	total: number;
	page: number;
	limit: number;
}
