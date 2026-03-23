import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { EventsGateway } from '../events/events.gateway';
import { User } from '../users/entities/user.entity';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private serializeNotification(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      channels: notification.metadata?.emailEnabled ? ['IN_APP', 'EMAIL'] : ['IN_APP'],
      metadata: notification.metadata || null,
    };
  }

  async ensurePreferences(userId: string) {
    let preferences = await this.preferenceRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (preferences) return preferences;

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    preferences = this.preferenceRepository.create({
      user,
      inAppEnabled: true,
      emailEnabled: false,
    });

    try {
      return await this.preferenceRepository.save(preferences);
    } catch (error: any) {
      if (error?.code === '23505') {
        const existing = await this.preferenceRepository.findOne({
          where: { user: { id: userId } },
          relations: ['user'],
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async listForUser(userId: string) {
    await this.ensurePreferences(userId);

    const notifications = await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return notifications.map((notification) => this.serializeNotification(notification));
  }

  async getPreferences(userId: string) {
    const preferences = await this.ensurePreferences(userId);
    return {
      inAppEnabled: preferences.inAppEnabled,
      emailEnabled: preferences.emailEnabled,
    };
  }

  async updatePreferences(
    userId: string,
    updates: Partial<{ inAppEnabled: boolean; emailEnabled: boolean }>,
  ) {
    const preferences = await this.ensurePreferences(userId);

    if (typeof updates.inAppEnabled === 'boolean') {
      preferences.inAppEnabled = updates.inAppEnabled;
    }

    if (typeof updates.emailEnabled === 'boolean') {
      preferences.emailEnabled = updates.emailEnabled;
    }

    const saved = await this.preferenceRepository.save(preferences);
    const payload = {
      inAppEnabled: saved.inAppEnabled,
      emailEnabled: saved.emailEnabled,
    };

    this.eventsGateway.emitNotificationPreferencesUpdated(userId, payload);
    return payload;
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
      relations: ['user'],
    });
    if (!notification) throw new NotFoundException('Notification not found');

    notification.readAt = notification.readAt || new Date();
    const saved = await this.notificationRepository.save(notification);

    this.eventsGateway.emitNotificationRead(userId, saved.id, saved.readAt);
    return this.serializeNotification(saved);
  }

  async markAllRead(userId: string) {
    const notifications = await this.notificationRepository.find({
      where: { user: { id: userId }, readAt: IsNull() },
      relations: ['user'],
    });

    if (notifications.length === 0) {
      return { updated: 0 };
    }

    const readAt = new Date();
    for (const notification of notifications) {
      notification.readAt = readAt;
    }

    await this.notificationRepository.save(notifications);
    this.eventsGateway.emitNotificationsAllRead(userId);

    return { updated: notifications.length };
  }

  async createForUser(userId: string, payload: NotificationPayload) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const preferences = await this.ensurePreferences(userId);
    const notification = this.notificationRepository.create({
      user,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      metadata: {
        ...(payload.metadata || {}),
        emailEnabled: preferences.emailEnabled,
      },
      readAt: null,
    });

    const saved = await this.notificationRepository.save(notification);
    const serialized = this.serializeNotification(saved);
    this.eventsGateway.emitNotificationCreated(userId, serialized);
    return serialized;
  }

  async createForUsers(userIds: string[], payload: NotificationPayload) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) return [];

    const users = await this.userRepository.find({
      where: { id: In(uniqueUserIds) },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));
    const created: Array<ReturnType<NotificationsService['serializeNotification']>> = [];

    for (const userId of uniqueUserIds) {
      const user = userMap.get(userId);
      if (!user) continue;

      const preferences = await this.ensurePreferences(userId);
      const notification = this.notificationRepository.create({
        user,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: {
          ...(payload.metadata || {}),
          emailEnabled: preferences.emailEnabled,
        },
        readAt: null,
      });

      const saved = await this.notificationRepository.save(notification);
      const serialized = this.serializeNotification(saved);
      this.eventsGateway.emitNotificationCreated(userId, serialized);
      created.push(serialized);
    }

    return created;
  }
}
