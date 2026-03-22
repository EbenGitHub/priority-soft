import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Role } from '../enums/role.enum';
import { Location } from '../../locations/entities/location.entity';
import { Skill } from './skill.entity';
import { Availability } from './availability.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: 'password123' })
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.STAFF,
  })
  role: Role;

  @Column({ type: 'int', default: 0 })
  desiredHours: number;

  @ManyToMany(() => Location, location => location.users)
  @JoinTable({ name: 'user_locations' })
  locations: Location[];

  @ManyToMany(() => Skill, skill => skill.users)
  @JoinTable({ name: 'user_skills' })
  skills: Skill[];

  @OneToMany(() => Availability, availability => availability.user)
  availabilities: Availability[];
}
