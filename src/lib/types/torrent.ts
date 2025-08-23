import { type ConvertingState, State } from '$lib/types/enums';

export interface File {
	name: string;
	path: string;
	isDir: boolean;
	size?: number;
	children?: File[];
}

/**
 * Представляет информацию о видеофайле внутри торрента.
 */
export interface VideoFile {
	path: string;
	// *media.VideoInfo в Go означает, что поле может быть null
	videoInfo: VideoInfo | null;
	// Тип error в Go при сериализации в JSON обычно становится строкой или null
	error: string | null;
}

/**
 * Представляет информацию о торренте.
 */
export interface Torrent {
	infoHash: string;
	name: string;
	magnet: string;
	size: number;
	done: boolean;
	state: State;
	convertingState: ConvertingState;
	completedAt?: Date;
	convertingQueuedAt?: string;
	convertedAt?: Date;
	lastChecked: Date;
	downloadedPercent: number;
	downloadSpeed: number;
	videoFiles?: VideoFile[];
}

/**
 * Содержит флаги потока (например, "по умолчанию" или "форсированный").
 */
export interface Disposition {
	default: number;
	dub: number;
	original: number;
	comment: number;
	lyrics: number;
	karaoke: number;
	forced: number;
	hearing_impaired: number;
	visual_impaired: number;
	clean_effects: number;
	attached_pic: number;
	timed_thumbnails: number;
}

/**
 * Содержит метаданные (теги) для конкретного потока.
 * Названия полей (например, `NUMBER_OF_FRAMES`) сохранены в соответствии
 * с выводом ffprobe и тегами `json:"..."` в Go.
 */
export interface StreamTags {
	language?: string;
	title?: string;
	BPS?: string;
	DURATION?: string;
	NUMBER_OF_FRAMES?: string;
	NUMBER_OF_BYTES?: string;
	_STATISTICS_WRITING_APP?: string;
	_STATISTICS_WRITING_DATE_UTC?: string;
	_STATISTICS_TAGS?: string;
	filename?: string;
	mimetype?: string;
}

/**
 * Содержит информацию об одном потоке (видео, аудио, субтитры и т.д.).
 */
export interface Stream {
	index: number;
	codec_name: string;
	codec_long_name?: string;
	profile?: string;
	codec_type: string; // 'video', 'audio', 'subtitle'
	codec_tag_string?: string;
	codec_tag?: string;
	width?: number;
	height?: number;
	coded_width?: number;
	coded_height?: number;
	closed_captions?: number;
	has_b_frames?: number;
	sample_aspect_ratio?: string;
	display_aspect_ratio?: string;
	pix_fmt?: string;
	level?: number;
	color_range?: string;
	color_space?: string;
	color_transfer?: string;
	color_primaries?: string;
	chroma_location?: string;
	refs?: number;
	r_frame_rate?: string;
	avg_frame_rate?: string;
	time_base?: string;
	start_pts?: number;
	start_time?: string;
	duration_ts?: number;
	duration?: string;
	bit_rate?: string;
	disposition?: Disposition;
	tags?: StreamTags;

	// Поля для аудио
	sample_fmt?: string;
	sample_rate?: string;
	channels?: number;
	channel_layout?: string;
	bits_per_sample?: number;
}

/**
 * Содержит метаданные (теги) для всего файла.
 */
export interface FormatTags {
	encoder?: string;
	creation_time?: string;
}

/**
 * Содержит информацию о формате медиаконтейнера в целом.
 */
export interface Format {
	filename: string;
	nb_streams: number;
	nb_programs: number;
	format_name: string;
	format_long_name: string;
	start_time: string;
	duration: string;
	// size и bit_rate часто возвращаются как строки ffprobe
	size: string;
	bit_rate: string;
	probe_score: number;
	tags: FormatTags;
}

/**
 * Корневая структура для хранения информации о видео из ffprobe.
 */
export interface VideoInfo {
	streams: Stream[];
	format: Format;
}
