import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Locator } from './locator.entity';

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** M_Warehouse.M_Warehouse_ID */
  @Column({ unique: true })
  idempiereId: number;

  /** M_Warehouse.Value */
  @Column({ unique: true })
  value: string;

  /** M_Warehouse.Name */
  @Column()
  name: string;

  /** M_Warehouse.Description */
  @Column({ nullable: true })
  description: string;

  /** M_Warehouse.IsActive */
  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Locator, (l) => l.warehouse)
  locators: Locator[];
}
