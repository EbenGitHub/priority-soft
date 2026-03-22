import { NotificationPreference, NotificationRecord } from './notificationTypes';

function getApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'Notification request failed');
  }

  return response.json() as Promise<T>;
}

export async function fetchNotifications(userId: string) {
  const response = await fetch(`${getApiUrl()}/notifications/users/${userId}`);
  return parseResponse<NotificationRecord[]>(response);
}

export async function fetchNotificationPreferences(userId: string) {
  const response = await fetch(`${getApiUrl()}/notifications/users/${userId}/preferences`);
  return parseResponse<NotificationPreference>(response);
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreference>,
) {
  const response = await fetch(`${getApiUrl()}/notifications/users/${userId}/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  return parseResponse<NotificationPreference>(response);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const response = await fetch(`${getApiUrl()}/notifications/users/${userId}/${notificationId}/read`, {
    method: 'PUT',
  });
  return parseResponse<NotificationRecord>(response);
}

export async function markAllNotificationsRead(userId: string) {
  const response = await fetch(`${getApiUrl()}/notifications/users/${userId}/read-all`, {
    method: 'PUT',
  });
  return parseResponse<{ updated: number }>(response);
}
