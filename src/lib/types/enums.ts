export enum TorrentState {
	Downloading = 'Скачивание',
	Completed = 'Скачивание завершено',
	Queued = 'В очереди на скачивание',
	Paused = 'На паузе'
}

export enum TorrentConvertingState {
	NotConverted = 'Не конвертировано',
	ConvertingQueued = 'В очереди на конвертацию',
	Converting = 'Конвертирование',
	Converted = 'Конвертирование завершено',
	ConvertingError = 'Ошибка при конвертировании'
}

/**
 * Состояние торрента.
 * В Go это был const с iota, что эквивалентно числовому enum в TypeScript.
 */
export enum State {
	Downloading, // 0
	Queued, // 1
	Completed, // 2
	Paused // 3
}

/**
 * Состояние конвертации видеофайла.
 */
export enum ConvertingState {
	NotConverted, // 0 - Не конвертировано
	ConvertingQueued, // 1 - В очереди на конвертацию
	Converting, // 2 - В процессе конвертации
	Converted, // 3 - Успешно конвертирован
	ConvertingError // 4 - Ошибка при конвертации
}
