import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('schedule_settings')
export class ScheduleSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 48 })
  cutoffHours: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
