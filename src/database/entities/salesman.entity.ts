import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('salesman')
export class Salesman {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** C_BPartner.C_BPartner_ID dari iDempiere */
  @Column({ unique: true })
  idempiereId: number;

  /** C_BPartner.Value */
  @Column({ unique: true })
  value: string;

  /** C_BPartner.Name */
  @Column()
  name: string;

  /** C_BPartner.Name2 */
  @Column({ nullable: true })
  name2: string;

  /** AD_User.EMail */
  @Column({ nullable: true })
  email: string;

  /** AD_User.Phone */
  @Column({ nullable: true })
  phone: string;

  /** C_Position atau custom position */
  @Column({ nullable: true })
  position: string;

  /** Level/grade posisi */
  @Column({ nullable: true })
  positionCodeLevel: number;

  /** C_BP_Group.Name */
  @Column({ nullable: true })
  bpGroup: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}