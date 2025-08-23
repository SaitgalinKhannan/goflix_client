export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
	id: string;
	type: NotificationType;
	title?: string;
	message: string;
	timeout?: number; // Milliseconds before the notification disappears
}
