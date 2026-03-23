import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { AvailabilityType } from '../enums/availability-type.enum';
import { Location } from '../../locations/entities/location.entity';

@Entity('availabilities')
export class Availability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.availabilities, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'locationId' })
  location?: Location | null;

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
