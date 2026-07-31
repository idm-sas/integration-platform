import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';

@Entity('locators')
export class Locator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** M_Locator.M_Locator_ID */
  @Column({ unique: true })
  idempiereId: number;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse, (w) => w.locators)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  /** M_Locator.Value */
  @Column()
  value: string;

  /** M_Locator.X — Aisle */
  @Column({ nullable: true })
  aisle: string;

  /** M_Locator.Y — Bin */
  @Column({ nullable: true })
  bin: string;

  /** M_Locator.Z — Level */
  @Column({ nullable: true })
  level: string;

  @Column({ default: 0 })
  priorityNo: number;

  /** M_Locator.M_LocatorType_ID */
  @Column({ nullable: false })
  locatorTypeId: number;

  /** M_Locator.IsDefault */
  @Column({ default: false })
  isDefault: boolean;

  /** M_Locator.IsActive */
  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
