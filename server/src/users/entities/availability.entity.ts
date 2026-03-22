import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { AvailabilityType } from '../enums/availability-type.enum';

@Entity('availabilities')
export class Availability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.availabilities, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: AvailabilityType,
    default: AvailabilityType.RECURRING,
  })
  type: AvailabilityType;

  @Column({ type: 'int', nullable: true })
  dayOfWeek: number;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ default: 'UTC' })
  timezone: string;
}
