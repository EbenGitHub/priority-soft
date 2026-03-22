import { AuditLogRecord } from './auditTypes';

function getApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

export async function fetchShiftAuditLogs(shiftId: string) {
  const response = await fetch(`${getApiUrl()}/audit/shifts/${shiftId}`);
  if (!response.ok) throw new Error('Audit history unavailable');
  return response.json() as Promise<AuditLogRecord[]>;
}

export async function fetchAuditLogs(filters: {
  locationId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const params = new URLSearchParams();
  if (filters.locationId) params.set('locationId', filters.locationId);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);

  const response = await fetch(`${getApiUrl()}/audit/logs?${params.toString()}`);
  if (!response.ok) throw new Error('Audit export unavailable');
  return response.json() as Promise<AuditLogRecord[]>;
}

export async function exportAuditLogsCsv(filters: {
  locationId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const params = new URLSearchParams();
  params.set('format', 'csv');
  if (filters.locationId) params.set('locationId', filters.locationId);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);

  const response = await fetch(`${getApiUrl()}/audit/logs/export?${params.toString()}`);
  if (!response.ok) throw new Error('Audit CSV export unavailable');
  return response.text();
}
