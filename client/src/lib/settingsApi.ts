function getApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

export type SchedulingSettings = {
  id: string;
  cutoffHours: number;
  updatedAt: string;
};

export async function fetchSchedulingSettings() {
  const response = await fetch(`${getApiUrl()}/settings/scheduling`);
  if (!response.ok) {
    throw new Error('Settings endpoint unavailable');
  }
  return response.json() as Promise<SchedulingSettings>;
}

export async function updateSchedulingSettings(payload: { cutoffHours: number; actorId?: string }) {
  const response = await fetch(`${getApiUrl()}/settings/scheduling`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'Unable to update scheduling settings');
  }
  return response.json() as Promise<SchedulingSettings>;
}
