import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class AnalyticsService {
   constructor(
      @InjectRepository(User) private readonly userRepo: Repository<User>,
      @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>
   ) {}

   async getFairnessMetrics(locationId?: string) {
      // Fetch entire active staff roster dynamically bypassing local mock stores.
      const staffList = await this.userRepo.find({ where: { role: Role.STAFF } });
      
      const shiftQuery = this.shiftRepo.createQueryBuilder('shift')
        .leftJoinAndSelect('shift.assignedStaff', 'assignedStaff');
        
      if (locationId) {
         shiftQuery.andWhere('shift.locationId = :locId', { locId: locationId });
      }
      const shifts = await shiftQuery.getMany();
      
      // Premium tracking: Core logic defining a structurally isolated high-value payload target.
      const isPremium = (authShift: Shift) => {
         const dt = new Date(`${authShift.date}T12:00:00Z`);
         const dow = dt.getUTCDay(); // 5 = Friday, 6 = Saturday
         if (dow !== 5 && dow !== 6) return false;
         return authShift.startTime >= '17:00' || authShift.startTime.startsWith('17:') || authShift.startTime.startsWith('18:') || authShift.startTime.startsWith('19:') || authShift.startTime.startsWith('20:') || authShift.startTime.startsWith('21:') || authShift.startTime.startsWith('22:') || authShift.startTime.startsWith('23:');
      };

      let totalPremium = 0;
      const metrics = staffList.map(staff => {
          const pShifts = shifts.filter(s => s.assignedStaff?.id === staff.id);
          let hrs = 0;
          let premiumCount = 0;

          pShifts.forEach(s => {
              if (s.startTime && s.endTime) {
                 const strt = new Date(`${s.date}T${s.startTime}`).getTime();
                 const nd = new Date(`${s.date}T${s.endTime}`).getTime();
                 hrs += (nd - strt) / (1000 * 60 * 60);
              }
              if (isPremium(s)) {
                 premiumCount++;
                 totalPremium++;
              }
          });

          const tHours = staff.desiredHours || 40;
          return {
             staff: { id: staff.id, name: staff.name },
             assignedHours: hrs,
             targetHours: tHours,
             hoursVariance: hrs - tHours,
             premiumShifts: premiumCount
          };
      });

      const premiumCounts = metrics.map(m => m.premiumShifts);
      const mean = totalPremium / (staffList.length || 1);
      
      const variance = premiumCounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (staffList.length || 1);
      const stdDev = Math.sqrt(variance);

      let score = 100 - ((stdDev / (mean || 1)) * 50);
      if (totalPremium === 0 || staffList.length <= 1) score = 100;

      return {
         overallScore: Math.max(0, Math.min(100, Math.round(score))),
         totalPremiumShifts: totalPremium,
         staffMetrics: metrics.sort((a,b) => {
            if (b.premiumShifts !== a.premiumShifts) return b.premiumShifts - a.premiumShifts;
            return a.staff.name.localeCompare(b.staff.name);
         })
      };
   }
}
