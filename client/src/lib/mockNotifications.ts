import { Role } from './mockData';
import {
  NotificationPreference,
  NotificationRecord,
  NotificationType,
} from './notificationTypes';

const mockPreferenceDefaults: NotificationPreference = {
  inAppEnabled: true,
  emailEnabled: false,
};

const typeChannels: Record<NotificationType, NotificationRecord['channels']> = {
  SHIFT_ASSIGNED: ['IN_APP'],
  SHIFT_UPDATED: ['IN_APP'],
  SCHEDULE_PUBLISHED: ['IN_APP', 'EMAIL'],
  SWAP_REQUEST_SUBMITTED: ['IN_APP'],
  SWAP_REQUEST_APPROVED: ['IN_APP', 'EMAIL'],
  SWAP_REQUEST_REJECTED: ['IN_APP'],
  SWAP_REQUEST_CANCELLED: ['IN_APP'],
  DROP_REQUEST_OPEN: ['IN_APP'],
  DROP_REQUEST_CLAIMED: ['IN_APP'],
  SWAP_APPROVAL_REQUIRED: ['IN_APP', 'EMAIL'],
  OVERTIME_WARNING: ['IN_APP', 'EMAIL'],
  AVAILABILITY_CHANGED: ['IN_APP'],
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function buildNotification(
  id: string,
  type: NotificationType,
  title: string,
  message: string,
  createdAt: string,
  readAt: string | null = null,
): NotificationRecord {
  return {
    id,
    type,
    title,
    message,
    createdAt,
    readAt,
    channels: typeChannels[type],
  };
}

function mockNotificationsForRole(role: Role): NotificationRecord[] {
  if (role === 'MANAGER') {
    return [
      buildNotification(
        'mock-manager-1',
        'SWAP_APPROVAL_REQUIRED',
        'Swap approval needed',
        'Sarah Server and Maria Bartender are waiting on manager approval for a Friday evening swap.',
        hoursAgo(1),
      ),
      buildNotification(
        'mock-manager-2',
        'OVERTIME_WARNING',
        'Projected overtime alert',
        'Maria Bartender reaches 38.5 hours if you keep the Sunday closing assignment.',
        hoursAgo(4),
      ),
      buildNotification(
        'mock-manager-3',
        'AVAILABILITY_CHANGED',
        'Availability updated',
        'John Cook added a one-off availability exception for Tuesday, March 24.',
        hoursAgo(20),
        hoursAgo(18),
      ),
    ];
  }

  if (role === 'ADMIN') {
    return [
      buildNotification(
        'mock-admin-1',
        'OVERTIME_WARNING',
        'Cross-location overtime risk',
        'The LA team has 3 staff members projected above 35 hours this week.',
        hoursAgo(2),
      ),
      buildNotification(
        'mock-admin-2',
        'SCHEDULE_PUBLISHED',
        'Schedule published',
        'West Coast week-of March 23 schedules were published successfully.',
        hoursAgo(8),
        hoursAgo(6),
      ),
    ];
  }

  return [
    buildNotification(
      'mock-staff-1',
      'SHIFT_ASSIGNED',
      'New shift assigned',
      'You were assigned to the NYC lunch shift on Tuesday, March 24 from 11:00 to 17:00.',
      hoursAgo(1),
    ),
    buildNotification(
      'mock-staff-2',
      'SHIFT_UPDATED',
      'Shift time changed',
      'Your Thursday host shift now starts at 16:00 instead of 15:00.',
      hoursAgo(6),
    ),
    buildNotification(
      'mock-staff-3',
      'SCHEDULE_PUBLISHED',
      'Weekly schedule published',
      'Your schedule for the week of March 23 is now visible.',
      hoursAgo(10),
      hoursAgo(9),
    ),
    buildNotification(
      'mock-staff-4',
      'SWAP_REQUEST_APPROVED',
      'Swap approved',
      'Your swap request with Maria Bartender was approved by East Coast Manager.',
      hoursAgo(24),
      hoursAgo(23),
    ),
  ];
}

function notificationsKey(userId: string) {
  return `shiftSync_notifications_${userId}`;
}

function preferencesKey(userId: string) {
  return `shiftSync_notification_prefs_${userId}`;
}

export function loadMockNotifications(user: { id: string; role: Role }) {
  if (typeof window === 'undefined') {
    return {
      notifications: mockNotificationsForRole(user.role),
      preferences: mockPreferenceDefaults,
    };
  }

  const rawNotifications = window.localStorage.getItem(notificationsKey(user.id));
  const rawPreferences = window.localStorage.getItem(preferencesKey(user.id));

  const notifications = rawNotifications
    ? (JSON.parse(rawNotifications) as NotificationRecord[])
    : mockNotificationsForRole(user.role);
  const preferences = rawPreferences
    ? (JSON.parse(rawPreferences) as NotificationPreference)
    : mockPreferenceDefaults;

  window.localStorage.setItem(notificationsKey(user.id), JSON.stringify(notifications));
  window.localStorage.setItem(preferencesKey(user.id), JSON.stringify(preferences));

  return { notifications, preferences };
}

export function persistMockNotifications(userId: string, notifications: NotificationRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(notificationsKey(userId), JSON.stringify(notifications));
}

export function persistMockPreferences(userId: string, preferences: NotificationPreference) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences));
}
