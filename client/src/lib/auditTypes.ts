export type AuditAction =
  | 'SHIFT_CREATED'
  | 'SHIFT_ASSIGNED'
  | 'SHIFT_UNASSIGNED'
  | 'SHIFT_REASSIGNED'
  | 'SHIFT_PUBLISHED'
  | 'SHIFT_UNPUBLISHED';

export interface AuditLogRecord {
  id: string;
  shiftId: string;
  locationId: string;
  locationName: string;
  action: AuditAction;
  actorId: string | null;
  actorName: string;
  actorRole: 'ADMIN' | 'MANAGER' | 'SYSTEM';
  occurredAt: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  summary: string;
}
