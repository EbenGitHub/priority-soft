import { Shift, Staff } from './mockData';

export interface FairnessAnalytics {
  overallScore: number;
  staffMetrics: {
     staff: Staff;
     assignedHours: number;
     targetHours: number;
     hoursVariance: number;
     premiumShifts: number;
  }[];
  totalPremiumShifts: number;
}

export function computeFairnessMock(staffList: Staff[], shifts: Shift[]): FairnessAnalytics {
   // Premium shift defined as: Friday or Saturday, and starting at/after 5pm (17:00)
   const isPremium = (authShift: Shift) => {
      const dt = new Date(`${authShift.date}T12:00:00Z`);
      const dow = dt.getUTCDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
      if (dow !== 5 && dow !== 6) return false;
      if (!authShift.startTime) return false;
      return authShift.startTime >= '17:00' || authShift.startTime.startsWith('17:') || authShift.startTime.startsWith('18:') || authShift.startTime.startsWith('19:') || authShift.startTime.startsWith('20:') || authShift.startTime.startsWith('21:') || authShift.startTime.startsWith('22:') || authShift.startTime.startsWith('23:');
   };

   let totalPremium = 0;
   const metrics = staffList.map(staff => {
       const pShifts = shifts.filter(s => s.assignedStaff?.id === staff.id);
       let hrs = 0;
       let premiumCount = 0;
       
       pShifts.forEach(s => {
           if (s.startTime && s.endTime) {
              const start = new Date(`${s.date}T${s.startTime}`).getTime();
              const end = new Date(`${s.date}T${s.endTime}`).getTime();
              hrs += (end - start) / (1000*60*60);
           }
           if (isPremium(s)) {
              premiumCount++;
              totalPremium++;
           }
       });

       const tHours = staff.desiredHours || 40;
       return {
          staff,
          assignedHours: hrs,
          targetHours: tHours,
          hoursVariance: hrs - tHours,
          premiumShifts: premiumCount
       };
   });

   const premiumCounts = metrics.map(m => m.premiumShifts);
   const mean = totalPremium / (staffList.length || 1);
   
   // Calculate Standard Deviation of Premium Shifts
   const variance = premiumCounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (staffList.length || 1);
   const stdDev = Math.sqrt(variance);

   // Score normalization: 100 is perfectly fair (stdDev = 0). 
   // We deduct points relative to the standard deviation scalar.
   let score = 100 - ((stdDev / (mean || 1)) * 50);
   if (totalPremium === 0 || staffList.length <= 1) score = 100;
   
   return {
      overallScore: Math.max(0, Math.min(100, Math.round(score))),
      staffMetrics: metrics.sort((a,b) => {
         // Sort by premium shifts descending initially
         if (b.premiumShifts !== a.premiumShifts) return b.premiumShifts - a.premiumShifts;
         return a.staff.name.localeCompare(b.staff.name);
      }),
      totalPremiumShifts: totalPremium
   };
}
