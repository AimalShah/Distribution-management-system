export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  desc?: string;
  time: string;
  type?: string;
  unread: boolean;
}

export const initialNotifications: NotificationItem[] = [];
