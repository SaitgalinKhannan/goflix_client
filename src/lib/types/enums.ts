export enum TorrentState {
	Downloading = 'Скачивание',
	Completed = 'Скачивание завершено',
	Queued = 'В очереди на скачивание',
	Paused = 'На паузе',
}

export enum TorrentConvertingState {
	NotConverted = 'Не конвертировано',
	ConvertingQueued = 'В очереди на конвертацию',
	Converting = 'Конвертирование',
	Converted = 'Конвертирование завершено',
	ConvertingError = 'Ошибка при конвертировании',
}