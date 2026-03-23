import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, VersionColumn } from 'typeorm';
import { Location } from '../../locations/entities/location.entity';
import { Skill } from '../../users/entities/skill.entity';
import { User } from '../../users/entities/user.entity';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  location: Location;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'timestamptz', nullable: true })
  startUtc: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endUtc: Date | null;

  @Column({ default: false })
  isOvernight: boolean;

  @Column({ default: false })
  skipManagerApproval: boolean;

  @ManyToOne(() => Skill, { onDelete: 'RESTRICT' })
  requiredSkill: Skill;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  assignedStaff: User | null;

  @Column({ type: 'uuid', nullable: true })
  scheduleGroupId: string | null;

  @Column({ type: 'int', default: 1 })
  headcountNeeded: number;

  @Column({ type: 'int', default: 1 })
  slotIndex: number;

  @Column({ default: false })
  published: boolean;

  @VersionColumn()
  version: number;
}
