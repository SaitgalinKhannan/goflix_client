import { API_URL } from '$lib/config/api';
import { API_ENDPOINTS } from '$lib/utils/constants';
import type { PageLoad } from './$types';
import type { Torrent } from '$lib/types/torrent';

export const load: PageLoad = async ({ fetch }) => {
	try {
		const response = await fetch(API_URL + API_ENDPOINTS.TORRENTS);
		if (!response.ok) {
			console.error(`Failed to load torrents: ${response.status}`);
			return { torrents: [] };
		}
		const data = await response.json();
		if (Array.isArray(data)) {
			return { torrents: data as Torrent[] };
		} else {
			console.error('Invalid response format from server', data);
			return { torrents: [] };
		}
	} catch (err) {
		console.error('Error loading torrents:', err);
		return { torrents: [] };
	}
};
