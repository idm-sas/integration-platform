import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Principal } from './principal.entity';

@Entity('api_audit_logs')
export class ApiAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  principalId: string;

  @ManyToOne(() => Principal, (p) => p.auditLogs, { nullable: true })
  @JoinColumn({ name: 'principalId' })
  principal: Principal;

  @Column()
  method: string;

  @Column()
  endpoint: string;

  @Column({ nullable: true })
  queryParams: string;

  @Column({ nullable: true })
  requestBody: string;

  @Column()
  statusCode: number;

  @Column()
  durationMs: number;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
