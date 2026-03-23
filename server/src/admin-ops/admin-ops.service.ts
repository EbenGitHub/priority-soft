import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthzService } from '../authz/authz.service';
import { Permission } from '../authz/permissions.enum';
import { SeedService } from '../seed/seed.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AdminOpsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly authzService: AuthzService,
    private readonly seedService: SeedService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private async assertAdmin(actorId?: string) {
    return this.authzService.assertPermission(actorId, Permission.OPERATIONS_MANAGE);
  }

  private emitProgress(
    actorId: string | undefined,
    payload: Parameters<EventsGateway['emitOperationProgress']>[1],
  ) {
    if (!actorId) return;
    this.eventsGateway.emitOperationProgress(actorId, payload);
  }

  async resetDatabase(actorId?: string) {
    await this.assertAdmin(actorId);
    this.emitProgress(actorId, {
      scope: 'reset',
      target: 'all',
      status: 'running',
      message: 'Scanning tables before reset...',
    });

    const tableCounts = await this.dataSource.query(`
      SELECT 'audit_logs' AS table_name, COUNT(*)::int AS count FROM "audit_logs"
      UNION ALL SELECT 'swap_requests', COUNT(*)::int FROM "swap_requests"
      UNION ALL SELECT 'notifications', COUNT(*)::int FROM "notifications"
      UNION ALL SELECT 'notification_preferences', COUNT(*)::int FROM "notification_preferences"
      UNION ALL SELECT 'availabilities', COUNT(*)::int FROM "availabilities"
      UNION ALL SELECT 'shifts', COUNT(*)::int FROM "shifts"
      UNION ALL SELECT 'user_skills', COUNT(*)::int FROM "user_skills"
      UNION ALL SELECT 'user_locations', COUNT(*)::int FROM "user_locations"
      UNION ALL SELECT 'users', COUNT(*)::int FROM "users"
      UNION ALL SELECT 'skills', COUNT(*)::int FROM "skills"
      UNION ALL SELECT 'locations', COUNT(*)::int FROM "locations"
      UNION ALL SELECT 'schedule_settings', COUNT(*)::int FROM "schedule_settings"
    `);

    for (const row of tableCounts as Array<{ table_name: string; count: number }>) {
      this.emitProgress(actorId, {
        scope: 'reset',
        target: row.table_name,
        status: 'running',
        message: `${row.table_name} queued for deletion`,
        counts: { rows: Number(row.count) || 0 },
      });
    }

    try {
      const adminUsers = await this.dataSource.query(
        `SELECT id, name, email, password, role, "desiredHours" FROM "users" WHERE role = 'ADMIN'`,
      );

      await this.dataSource.query(`
        TRUNCATE TABLE
          "audit_logs",
          "swap_requests",
          "notifications",
          "notification_preferences",
          "availabilities",
          "shifts",
          "user_skills",
          "user_locations",
          "users",
          "skills",
          "locations",
          "schedule_settings"
        RESTART IDENTITY CASCADE
      `);

      for (const admin of adminUsers) {
        await this.dataSource.query(
          `INSERT INTO "users" ("id", "name", "email", "password", "role", "desiredHours")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [admin.id, admin.name, admin.email, admin.password, admin.role, admin.desiredHours ?? 0],
        );
      }

      this.eventsGateway.emitSessionInvalidated(
        adminUsers.map((admin: { id: string }) => admin.id),
      );

      this.emitProgress(actorId, {
        scope: 'reset',
        target: 'all',
        status: 'completed',
        message: 'Database reset completed. Admin accounts were preserved.',
        counts: {
          preservedAdmins: adminUsers.length,
        },
      });

      return { ok: true, preservedAdmins: adminUsers.map((admin: { email: string }) => admin.email) };
    } catch (error: any) {
      this.emitProgress(actorId, {
        scope: 'reset',
        target: 'all',
        status: 'failed',
        message: error?.message || 'Database reset failed.',
      });
      throw error;
    }
  }

  async runSeed(target: 'all' | 'users' | 'shifts' | 'notifications' | 'audit', actorId?: string) {
    await this.assertAdmin(actorId);
    const countAll = async () => {
      const [users, availabilities, preferences, shifts, notifications, swaps, audit] =
        await Promise.all([
          this.dataSource.getRepository('users').count(),
          this.dataSource.getRepository('availabilities').count(),
          this.dataSource.getRepository('notification_preferences').count(),
          this.dataSource.getRepository('shifts').count(),
          this.dataSource.getRepository('notifications').count(),
          this.dataSource.getRepository('swap_requests').count(),
          this.dataSource.getRepository('audit_logs').count(),
        ]);

      return { users, availabilities, preferences, shifts, notifications, swaps, audit };
    };

    const diffCounts = (
      before: Awaited<ReturnType<typeof countAll>>,
      after: Awaited<ReturnType<typeof countAll>>,
    ) => ({
      users: after.users - before.users,
      availabilities: after.availabilities - before.availabilities,
      preferences: after.preferences - before.preferences,
      shifts: after.shifts - before.shifts,
      notifications: after.notifications - before.notifications,
      swaps: after.swaps - before.swaps,
      audit: after.audit - before.audit,
    });

    const before = await countAll();
    this.emitProgress(actorId, {
      scope: 'seed',
      target,
      status: 'running',
      message: `Starting ${target} seed...`,
    });

    try {
      switch (target) {
        case 'all':
          this.emitProgress(actorId, { scope: 'seed', target: 'users', status: 'running', message: 'Seeding users, locations, skills, availabilities, and preferences...' });
          await this.seedService.seedUsersBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'shifts', status: 'running', message: 'Seeding schedule groups and staffed shift scenarios...' });
          await this.seedService.seedShiftsBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'notifications', status: 'running', message: 'Seeding persisted notifications and preferences...' });
          await this.seedService.seedNotificationsBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'audit', status: 'running', message: 'Seeding audit trail entries and swap/drop requests...' });
          await this.seedService.seedAuditBundle();
          break;
        case 'users':
          this.emitProgress(actorId, { scope: 'seed', target: 'users', status: 'running', message: 'Seeding users, locations, skills, availabilities, and preferences...' });
          await this.seedService.seedUsersBundle();
          break;
        case 'shifts':
          this.emitProgress(actorId, { scope: 'seed', target: 'users', status: 'running', message: 'Ensuring prerequisite users exist...' });
          await this.seedService.seedUsersBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'shifts', status: 'running', message: 'Seeding shifts and schedule groups...' });
          await this.seedService.seedShiftsBundle();
          break;
        case 'notifications':
          this.emitProgress(actorId, { scope: 'seed', target: 'users', status: 'running', message: 'Ensuring prerequisite users exist...' });
          await this.seedService.seedUsersBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'shifts', status: 'running', message: 'Ensuring prerequisite shifts exist...' });
          await this.seedService.seedShiftsBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'notifications', status: 'running', message: 'Seeding notification records...' });
          await this.seedService.seedNotificationsBundle();
          break;
        case 'audit':
          this.emitProgress(actorId, { scope: 'seed', target: 'users', status: 'running', message: 'Ensuring prerequisite users exist...' });
          await this.seedService.seedUsersBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'shifts', status: 'running', message: 'Ensuring prerequisite shifts exist...' });
          await this.seedService.seedShiftsBundle();
          this.emitProgress(actorId, { scope: 'seed', target: 'audit', status: 'running', message: 'Seeding audit and swap records...' });
          await this.seedService.seedAuditBundle();
          break;
        default:
          throw new BadRequestException('Unknown seed target.');
      }
    } catch (error: any) {
      this.emitProgress(actorId, {
        scope: 'seed',
        target,
        status: 'failed',
        message: error?.message || `Seed failed for ${target}.`,
      });
      throw error;
    }

    const after = await countAll();
    this.emitProgress(actorId, {
      scope: 'seed',
      target,
      status: 'completed',
      message: `${target} seed completed.`,
      counts: diffCounts(before, after),
    });

    return { ok: true, target };
  }
}
