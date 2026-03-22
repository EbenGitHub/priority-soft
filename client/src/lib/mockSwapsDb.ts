export interface SwapRequest {
  id: string;
  initiatorUserId: string;
  initiatorUserName: string;
  type: 'SWAP' | 'DROP';
  initiatorShiftId: string;
  targetShiftId?: string | null;  // Shift sought in a SWAP
  targetUserId?: string | null;   // Peer accepting a swap/drop
  targetUserName?: string | null;
  status: 'PENDING_PEER' | 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string; // ISO Baseline Date
}

export function getMockSwaps(): SwapRequest[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem('shiftSync_swaps');
  if (!data) return [];
  return JSON.parse(data);
}

export function saveMockSwaps(swaps: SwapRequest[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('shiftSync_swaps', JSON.stringify(swaps));
  window.dispatchEvent(new Event('swapsUpdated')); 
}

export function requestDrop(userId: string, userName: string, shiftId: string) {
  const swaps = getMockSwaps();
  const pending = swaps.filter(s => s.initiatorUserId === userId && ['PENDING_PEER', 'PENDING_MANAGER'].includes(s.status));
  if (pending.length >= 3) throw new Error("Maximum constraint hit: Staff cannot sustain more than 3 pending swap/drop requests at once.");
  
  swaps.push({
    id: `req-${Date.now()}`,
    initiatorUserId: userId,
    initiatorUserName: userName,
    type: 'DROP',
    initiatorShiftId: shiftId,
    status: 'PENDING_PEER',
    createdAt: new Date().toISOString()
  });
  saveMockSwaps(swaps);
}

export function requestSwap(userId: string, userName: string, shiftId: string, targetShiftId: string, peerId: string, peerName: string) {
  const swaps = getMockSwaps();
  const pending = swaps.filter(s => s.initiatorUserId === userId && ['PENDING_PEER', 'PENDING_MANAGER'].includes(s.status));
  if (pending.length >= 3) throw new Error("Maximum constraint hit: Staff cannot sustain more than 3 pending swap/drop requests at once.");

  swaps.push({
    id: `req-${Date.now()}`,
    initiatorUserId: userId,
    initiatorUserName: userName,
    type: 'SWAP',
    initiatorShiftId: shiftId,
    targetShiftId: targetShiftId,
    targetUserId: peerId,
    targetUserName: peerName,
    status: 'PENDING_PEER',
    createdAt: new Date().toISOString()
  });
  saveMockSwaps(swaps);
}
