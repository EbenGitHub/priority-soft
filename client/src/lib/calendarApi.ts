import { Shift } from './mockData';

function getApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

export async function fetchCalendarShifts(params: {
  locationId?: string;
  viewerTimeZone?: string;
}) {
  const query = new URLSearchParams();
  if (params.locationId) query.set('locationId', params.locationId);
  if (params.viewerTimeZone) query.set('viewerTimeZone', params.viewerTimeZone);

  const response = await fetch(`${getApiUrl()}/calendar/shifts?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Calendar shifts endpoint unavailable');
  }

  return response.json() as Promise<Shift[]>;
}

export async function previewShiftTiming(payload: {
  locationId: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  viewerTimeZone?: string;
}) {
  const response = await fetch(`${getApiUrl()}/calendar/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Calendar preview endpoint unavailable');
  }

  return response.json();
}
