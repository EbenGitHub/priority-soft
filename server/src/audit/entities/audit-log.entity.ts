import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Shift } from '../../shifts/entities/shift.entity';
import { Location } from '../../locations/entities/location.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar' })
  actorName: string;

  @Column({ type: 'varchar' })
  actorRole: string;

  @Column({ type: 'simple-json', nullable: true })
  beforeState: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  afterState: Record<string, unknown> | null;

  @Column({ type: 'text' })
  summary: string;

  @CreateDateColumn()
  occurredAt: Date;
}
