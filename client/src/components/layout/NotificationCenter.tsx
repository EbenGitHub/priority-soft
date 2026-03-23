"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../../lib/notificationApi';
import {
  loadMockNotifications,
  persistMockNotifications,
  persistMockPreferences,
} from '../../lib/mockNotifications';
import { NotificationPreference, NotificationRecord } from '../../lib/notificationTypes';
import { getNotificationTarget } from '../../lib/notificationNavigation';

const typeStyles: Record<string, string> = {
  SHIFT_ASSIGNED: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  SHIFT_UPDATED: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  SCHEDULE_PUBLISHED: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  SWAP_REQUEST_SUBMITTED: 'text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10',
  SWAP_REQUEST_APPROVED: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  SWAP_REQUEST_REJECTED: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  SWAP_REQUEST_CANCELLED: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  DROP_REQUEST_OPEN: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  DROP_REQUEST_CLAIMED: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
  SWAP_APPROVAL_REQUIRED: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  OVERTIME_WARNING: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  AVAILABILITY_CHANGED: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
};

function relativeTime(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatType(type: string) {
  return type.replaceAll('_', ' ').toLowerCase();
}

export default function NotificationCenter({
  user,
}: {
  user: { id: string; role: 'ADMIN' | 'MANAGER' | 'STAFF' };
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference>({
    inAppEnabled: true,
    emailEnabled: false,
  });
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const [apiNotifications, apiPreferences] = await Promise.all([
          fetchNotifications(user.id),
          fetchNotificationPreferences(user.id),
        ]);

        if (cancelled) return;

        setNotifications(apiNotifications);
        setPreferences(apiPreferences);
        setUsingMockData(false);
      } catch {
        if (cancelled) return;

        const mockState = loadMockNotifications(user);
        setNotifications(mockState.notifications);
        setPreferences(mockState.preferences);
        setUsingMockData(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadState();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (usingMockData) {
      persistMockNotifications(user.id, notifications);
    }
  }, [notifications, user.id, usingMockData]);

  useEffect(() => {
    if (usingMockData) {
      persistMockPreferences(user.id, preferences);
    }
  }, [preferences, user.id, usingMockData]);

  useEffect(() => {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const socket: Socket = io(apiUrl, { transports: ['websocket'] });

    socket.on('connect', () => {
      socket.emit('notifications:join', { userId: user.id });
    });

    socket.on('notification_created', (incoming: NotificationRecord) => {
      setNotifications((current) => {
        if (current.some((item) => item.id === incoming.id)) return current;
        return [incoming, ...current];
      });
    });

    socket.on('notifications_all_read', (payload: { userId: string }) => {
      if (payload.userId !== user.id) return;
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    });

    socket.on('notification_read', (payload: { notificationId: string; readAt: string }) => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === payload.notificationId ? { ...item, readAt: payload.readAt } : item,
        ),
      );
    });

    socket.on('notification_preferences_updated', (payload: NotificationPreference) => {
      setPreferences(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [user.id]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.readAt === null).length,
    [notifications],
  );

  const visibleNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        if (!preferences.inAppEnabled) return false;
        if (!showUnreadOnly) return true;
        return item.readAt === null;
      }),
    [notifications, preferences.inAppEnabled, showUnreadOnly],
  );

  async function syncPreferences(next: NotificationPreference) {
    setPreferences(next);

    if (usingMockData) return;

    try {
      await updateNotificationPreferences(user.id, next);
    } catch {
      setUsingMockData(true);
      persistMockPreferences(user.id, next);
    }
  }

  async function handleMarkRead(notificationId: string) {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, readAt } : item)),
    );

    if (usingMockData) return;

    try {
      await markNotificationRead(user.id, notificationId);
    } catch {
      setUsingMockData(true);
    }
  }

  async function handleMarkAllRead() {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));

    if (usingMockData) return;

    try {
      await markAllNotificationsRead(user.id);
    } catch {
      setUsingMockData(true);
    }
  }

  async function handleNotificationClick(notification: NotificationRecord) {
    if (!notification.readAt) {
      await handleMarkRead(notification.id);
    }
    setIsOpen(false);
    router.push(getNotificationTarget(notification, user.role));
  }

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 text-slate-300 transition hover:border-slate-700 hover:text-white"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-950 bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-14 flex max-h-[min(40rem,calc(100vh-6rem))] w-[28rem] flex-col overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 shadow-2xl">
          <div className="border-b border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Notification Center</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {usingMockData ? 'Mock feed active' : 'Live feed active'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark all read
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  In-app
                </span>
                <button
                  type="button"
                  onClick={() =>
                    syncPreferences({
                      ...preferences,
                      inAppEnabled: !preferences.inAppEnabled,
                    })
                  }
                  className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    preferences.inAppEnabled
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {preferences.inAppEnabled ? 'Enabled' : 'Muted'}
                </button>
              </label>

              <label className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Email simulation
                </span>
                <button
                  type="button"
                  onClick={() =>
                    syncPreferences({
                      ...preferences,
                      emailEnabled: !preferences.emailEnabled,
                    })
                  }
                  className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    preferences.emailEnabled
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {preferences.emailEnabled ? 'Enabled' : 'In-app only'}
                </button>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="rounded-full border border-slate-800 bg-slate-900 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setShowUnreadOnly(false)}
                  className={`rounded-full px-3 py-1.5 font-semibold transition ${
                    !showUnreadOnly ? 'bg-slate-700 text-white' : 'text-slate-400'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnreadOnly(true)}
                  className={`rounded-full px-3 py-1.5 font-semibold transition ${
                    showUnreadOnly ? 'bg-slate-700 text-white' : 'text-slate-400'
                  }`}
                >
                  Unread
                </button>
              </div>
              <span className="text-xs text-slate-500">{unreadCount} unread</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
            {loading && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-10 text-center text-sm text-slate-500">
                Loading notifications...
              </div>
            )}

            {!loading && visibleNotifications.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-500">
                No notifications in this view.
              </div>
            )}

            {!loading && visibleNotifications.length > 0 && (
              <div className="space-y-3">
                {visibleNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      notification.readAt
                        ? 'border-slate-800 bg-slate-900/50'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                            typeStyles[notification.type] || 'border-slate-700 bg-slate-800 text-slate-300'
                          }`}
                        >
                          {formatType(notification.type)}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">{notification.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{notification.message}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">{relativeTime(notification.createdAt)}</p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {notification.channels.includes('EMAIL') ? 'In-app + email' : 'In-app'}
                        </p>
                        {notification.readAt === null && (
                          <span className="mt-3 inline-block rounded-full bg-blue-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
