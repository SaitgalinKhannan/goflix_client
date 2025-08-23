import { writable } from 'svelte/store';
import { WS_URL } from '$lib/config/api';
import type { Torrent } from '$lib/types/torrent';
import { getContext, setContext, onDestroy } from 'svelte';

const WS_CONTEXT_KEY = Symbol('websocket');
const RECONNECT_INTERVAL = 5000; // 5 seconds

function createWebSocketStore() {
	const { subscribe, set } = writable<Torrent[]>([]);
	let ws: WebSocket | null = null;
	let reconnectTimeout: number | null = null;

	function connect() {
		if (ws) {
			ws.close(1000, 'Reconnecting');
		}
		ws = new WebSocket(WS_URL);

		ws.onopen = () => {
			console.log('WebSocket connected');
			if (reconnectTimeout) {
				clearTimeout(reconnectTimeout);
				reconnectTimeout = null;
			}
		};

		ws.onmessage = (event: MessageEvent) => {
			try {
				if (typeof event.data === 'string') {
					const data = JSON.parse(event.data);
					if (Array.isArray(data)) {
						set(data as Torrent[]);
					}
				}
			} catch (e) {
				console.error('Failed to parse WebSocket message:', e);
			}
		};

		ws.onerror = (error: Event) => {
			console.error('WebSocket error:', error);
		};

		ws.onclose = (event: CloseEvent) => {
			console.warn(`WebSocket closed: [${event.code}] ${event.reason}`);
			if (event.code !== 1000) {
				// 1000 = normal closure
				console.log('Attempting to reconnect WebSocket...');
				reconnectTimeout = setTimeout(connect, RECONNECT_INTERVAL);
			}
		};
	}

	function disconnect() {
		if (ws) {
			ws.close(1000, 'Component unmounted');
			ws = null;
		}
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
	}

	// Initial connection
	connect();

	onDestroy(disconnect);

	return {
		subscribe,
		connect,
		disconnect
	};
}

export function setWebSocketContext() {
	const wsStore = createWebSocketStore();
	setContext(WS_CONTEXT_KEY, wsStore);
	return wsStore;
}

export function getWebSocketContext() {
	return getContext<ReturnType<typeof createWebSocketStore>>(WS_CONTEXT_KEY);
}
