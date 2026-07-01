import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Principal } from './principal.entity';

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nullable karena super principal tidak ada di tabel principals */
  @Column({ nullable: true })
  principalId: string;

  @ManyToOne(() => Principal, (p) => p.accessTokens, { nullable: true })
  @JoinColumn({ name: 'principalId' })
  principal: Principal;

  /** SHA-256 hash dari token */
  @Column({ unique: true })
  tokenHash: string;

  @Column('simple-array')
  scopes: string[];

  /** Flag super principal — bypass semua scope & category check */
  @Column({ default: false })
  isSuper: boolean;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  revokedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}