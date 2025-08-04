export interface Torrent {
	infoHash: string;
	name: string;
	magnet: string;
	size: number;
	done: boolean;
	state: number;
	convertingState: number;
	completedAt?: Date;
	queuedAt?: Date;
	convertedAt?: Date;
	lastChecked: Date;
	downloadedPercent: number;
}

export interface File {
	name: string;
	path: string;
	isDir: boolean;
	size?: number;
	children?: File[];
}