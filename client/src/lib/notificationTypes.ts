export type NotificationChannel = 'IN_APP' | 'EMAIL';

export type NotificationType =
  | 'SHIFT_ASSIGNED'
  | 'SHIFT_UPDATED'
  | 'SCHEDULE_PUBLISHED'
  | 'SWAP_REQUEST_SUBMITTED'
  | 'SWAP_REQUEST_APPROVED'
  | 'SWAP_REQUEST_REJECTED'
  | 'SWAP_REQUEST_CANCELLED'
  | 'DROP_REQUEST_OPEN'
  | 'DROP_REQUEST_CLAIMED'
  | 'SWAP_APPROVAL_REQUIRED'
  | 'OVERTIME_WARNING'
  | 'AVAILABILITY_CHANGED';

export interface NotificationPreference {
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  channels: NotificationChannel[];
  metadata?: Record<string, unknown> | null;
}
