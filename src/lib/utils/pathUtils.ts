// Функция для нормализации пути
export function normalizeFilePath(path: string): string {
	if (!path || path === '/') return '/';

	// Убираем множественные слеши и нормализуем
	const normalized = path.replace(/\/+/g, '/');

	// Убеждаемся что путь начинается с / и не заканчивается на / (кроме корня)
	const withLeadingSlash = normalized.startsWith('/') ? normalized : '/' + normalized;
	return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
		? withLeadingSlash.slice(0, -1)
		: withLeadingSlash;
}