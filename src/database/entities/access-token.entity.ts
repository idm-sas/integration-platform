import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Principal } from './principal.entity';

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  principalId: string;

  @ManyToOne(() => Principal, (p) => p.accessTokens)
  @JoinColumn({ name: 'principalId' })
  principal: Principal;

  /** SHA-256 hash dari token */
  @Column({ unique: true })
  tokenHash: string;

  @Column('simple-array')
  scopes: string[];

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  revokedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
