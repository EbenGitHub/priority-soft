import { Shift, Staff } from './mockData';

export type StaffSwapRequest = {
  id: string;
  type: string;
  status: string;
  initiatorShift?: Shift | null;
  targetShift?: Shift | null;
  initiatorUser?: Staff | null;
  targetUser?: Staff | null;
};

function getApiUrl(path: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  return `${baseUrl}${path}`;
}

export async function fetchStaffDashboardState(userId: string) {
  const [shiftsResponse, usersResponse, meResponse] = await Promise.all([
    fetch(getApiUrl('/shifts')),
    fetch(getApiUrl('/users')),
    fetch(getApiUrl(`/users/${userId}`)),
  ]);

  const shifts = shiftsResponse.ok ? ((await shiftsResponse.json()) as Shift[]) : [];
  const staff = usersResponse.ok ? ((await usersResponse.json()) as Staff[]) : [];
  const profile = meResponse.ok ? ((await meResponse.json()) as Staff) : null;

  return { shifts, staff, profile };
}

export async function fetchSwapRequests() {
  const response = await fetch(getApiUrl('/swaps'));
  if (!response.ok) return [] as StaffSwapRequest[];
  return (await response.json()) as StaffSwapRequest[];
}

export async function updateDesiredHours(userId: string, desiredHours: number) {
  const response = await fetch(getApiUrl(`/users/${userId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      desiredHours,
      actorId: userId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to update desired hours.');
  }

  return (await response.json()) as Staff;
}

export async function createAvailability(
  userId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(getApiUrl(`/users/${userId}/availability`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actorId: userId,
      ...payload,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to add availability.');
  }
}

export async function updateAvailability(
  userId: string,
  availabilityId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(getApiUrl(`/users/${userId}/availability/${availabilityId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actorId: userId,
      ...payload,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to update availability.');
  }

  return response.json();
}

export async function deleteAvailability(userId: string, availabilityId: string) {
  const response = await fetch(getApiUrl(`/users/${userId}/availability/${availabilityId}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actorId: userId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to delete availability.');
  }

  return response.json();
}

export async function createDropRequest(
  initiatorUserId: string,
  initiatorShiftId: string,
  reason: string,
) {
  const response = await fetch(getApiUrl('/swaps'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'DROP',
      initiatorUserId,
      initiatorShiftId,
      reason,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to submit drop request.');
  }
}

export async function createSwapRequest(payload: Record<string, unknown>) {
  const response = await fetch(getApiUrl('/swaps'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to create swap request.');
  }
}

export async function actOnSwapRequest(requestId: string, action: string, userId: string) {
  const response = await fetch(getApiUrl(`/swaps/${requestId}/${action}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Unable to process request.');
  }
}
