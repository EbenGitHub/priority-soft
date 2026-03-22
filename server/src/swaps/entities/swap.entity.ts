import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shift } from '../../shifts/entities/shift.entity';

@Entity('swap_requests')
export class SwapRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: 'SWAP' | 'DROP';

  @Column({ type: 'varchar', default: 'PENDING_PEER' })
  status: 'PENDING_PEER' | 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @Column({ type: 'varchar', nullable: true })
  reason: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'initiatorUserId' })
  initiatorUser: User;

  @ManyToOne(() => Shift, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiatorShiftId' })
  initiatorShift: Shift;

  @ManyToOne(() => Shift, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetShiftId' })
  targetShift: Shift;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User;

  @CreateDateColumn()
  createdAt: Date;
}
