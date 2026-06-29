import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { PrincipalCategoryAccess } from './principal-category-access.entity';
import { AccessToken } from './access-token.entity';
import { ApiAuditLog } from './api-audit-log.entity';

@Entity('principals')
export class Principal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clientId: string;

  @Column()
  clientSecretHash: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  /** Request per menit, 0 = unlimited */
  @Column({ default: 60 })
  rateLimitRpm: number;

  @Column({ default: 10 })
  rateLimitBurst: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => PrincipalCategoryAccess, (pca) => pca.principal)
  categoryAccesses: PrincipalCategoryAccess[];

  @OneToMany(() => AccessToken, (at) => at.principal)
  accessTokens: AccessToken[];

  @OneToMany(() => ApiAuditLog, (log) => log.principal)
  auditLogs: ApiAuditLog[];
}
