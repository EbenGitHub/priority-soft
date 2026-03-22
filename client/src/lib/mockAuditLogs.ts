import { AuditLogRecord } from './auditTypes';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const auditLogs: AuditLogRecord[] = [
  {
    id: 'audit-1',
    shiftId: 'shift-nyc-friday-close',
    locationId: 'loc-nyc',
    locationName: 'Coastal Eats - NYC',
    action: 'SHIFT_CREATED',
    actorId: 'manager-east',
    actorName: 'East Coast Manager',
    actorRole: 'MANAGER',
    occurredAt: hoursAgo(30),
    beforeState: null,
    afterState: {
      date: '2026-03-27',
      startTime: '23:00:00',
      endTime: '03:00:00',
      assignedStaffId: null,
      published: false,
    },
    summary: 'Created an overnight bartender shift for Friday close.',
  },
  {
    id: 'audit-2',
    shiftId: 'shift-nyc-friday-close',
    locationId: 'loc-nyc',
    locationName: 'Coastal Eats - NYC',
    action: 'SHIFT_ASSIGNED',
    actorId: 'manager-east',
    actorName: 'East Coast Manager',
    actorRole: 'MANAGER',
    occurredAt: hoursAgo(24),
    beforeState: {
      assignedStaffId: null,
      assignedStaffName: null,
      published: false,
    },
    afterState: {
      assignedStaffId: 'maria',
      assignedStaffName: 'Maria Bartender',
      published: false,
    },
    summary: 'Assigned Maria Bartender to the Friday close shift.',
  },
  {
    id: 'audit-3',
    shiftId: 'shift-nyc-friday-close',
    locationId: 'loc-nyc',
    locationName: 'Coastal Eats - NYC',
    action: 'SHIFT_PUBLISHED',
    actorId: 'manager-east',
    actorName: 'East Coast Manager',
    actorRole: 'MANAGER',
    occurredAt: hoursAgo(20),
    beforeState: {
      published: false,
    },
    afterState: {
      published: true,
    },
    summary: 'Published the shift to staff.',
  },
  {
    id: 'audit-4',
    shiftId: 'shift-seattle-brunch',
    locationId: 'loc-sea',
    locationName: 'Coastal Eats - Seattle',
    action: 'SHIFT_REASSIGNED',
    actorId: 'manager-west',
    actorName: 'West Coast Manager',
    actorRole: 'MANAGER',
    occurredAt: hoursAgo(5),
    beforeState: {
      assignedStaffId: 'john',
      assignedStaffName: 'John Cook',
    },
    afterState: {
      assignedStaffId: 'sarah',
      assignedStaffName: 'Sarah Server',
    },
    summary: 'Reassigned the brunch shift after a same-day callout.',
  },
];

export function getMockAuditLogsForShift(shiftId: string) {
  return auditLogs.filter((log) => log.shiftId === shiftId);
}

export function getMockAuditLogs(filters?: { locationId?: string; startDate?: string; endDate?: string }) {
  return auditLogs.filter((log) => {
    if (filters?.locationId && log.locationId !== filters.locationId) return false;
    if (filters?.startDate && log.occurredAt < `${filters.startDate}T00:00:00.000Z`) return false;
    if (filters?.endDate && log.occurredAt > `${filters.endDate}T23:59:59.999Z`) return false;
    return true;
  });
}

export function exportMockAuditLogsCsv(filters?: { locationId?: string; startDate?: string; endDate?: string }) {
  const rows = getMockAuditLogs(filters);
  const header = [
    'id',
    'occurredAt',
    'locationName',
    'shiftId',
    'action',
    'actorName',
    'actorRole',
    'summary',
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.occurredAt,
      row.locationName,
      row.shiftId,
      row.action,
      row.actorName,
      row.actorRole,
      row.summary,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  );

  return [header.join(','), ...lines].join('\n');
}
