import { writable } from 'svelte/store';
import type { Notification, NotificationType } from '$lib/types/notification';

interface NotificationsStore {
	subscribe: (
		this: void,
		run: (value: Notification[]) => void,
		invalidate?: ((value?: Notification[]) => void) | undefined
	) => () => void;
	add: (message: string, type?: NotificationType, title?: string, timeout?: number) => void;
	remove: (id: string) => void;
}

function createNotificationStore(): NotificationsStore {
	const { subscribe, update } = writable<Notification[]>([]);

	return {
		subscribe,
		add: (
			message: string,
			type: NotificationType = 'info',
			title?: string,
			timeout: number = 3000
		) => {
			const id = Math.random().toString(36).substring(2, 9);
			const newNotification: Notification = { id, message, type, title, timeout };
			update((notifications) => [...notifications, newNotification]);
		},
		remove: (id: string) => {
			update((notifications) => notifications.filter((notification) => notification.id !== id));
		}
	};
}

export const notifications = createNotificationStore();
