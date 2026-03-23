import { NotificationRecord } from './notificationTypes';

type SessionRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export function getNotificationTarget(
  notification: NotificationRecord,
  role: SessionRole,
) {
  if (role === 'STAFF') {
    if (notification.type === 'DROP_REQUEST_OPEN') {
      return '/dashboard#coverage-marketplace';
    }
    if (
      notification.type === 'SWAP_REQUEST_APPROVED' ||
      notification.type === 'SWAP_REQUEST_REJECTED' ||
      notification.type === 'SWAP_REQUEST_CANCELLED'
    ) {
      return '/dashboard#notification-inbox';
    }
    return '/dashboard#my-scheduled-shifts';
  }

  if (role === 'MANAGER') {
    if (
      notification.type === 'SWAP_APPROVAL_REQUIRED' ||
      notification.type === 'DROP_REQUEST_CLAIMED' ||
      notification.type === 'SWAP_REQUEST_SUBMITTED'
    ) {
      return '/dashboard#approval-queue';
    }
    if (notification.type === 'AVAILABILITY_CHANGED') {
      return '/dashboard/users#staff-directory';
    }
    if (notification.type === 'OVERTIME_WARNING') {
      return '/dashboard#overtime-watchlist';
    }
    return '/dashboard/schedules';
  }

  if (notification.type === 'AVAILABILITY_CHANGED') {
    return '/dashboard/users#staff-directory';
  }
  if (notification.type === 'OVERTIME_WARNING') {
    return '/dashboard#operations-calendar';
  }
  if (notification.type === 'SCHEDULE_PUBLISHED' || notification.type === 'SHIFT_UPDATED') {
    return '/dashboard#operations-calendar';
  }
  return '/dashboard#audit-export-console';
}
