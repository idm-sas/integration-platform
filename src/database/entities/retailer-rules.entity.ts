import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Retailer } from './retailers.entity';
import { ProductCategory } from './product-category.entity';
import { Salesman } from './salesman.entity';

@Entity('retailer_rules')
export class RetailerRules {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SAS_BPRule.SAS_BPRule_ID dari iDempiere */
  @Column({ unique: true })
  idempiereId: number;

  @Column()
  retailerId: string;

  @ManyToOne(() => Retailer, retailer => retailer.rules)
  retailer: Retailer;

  @ManyToOne(() => ProductCategory)
  category: ProductCategory;

  @ManyToOne(() => Salesman)
  salesman: Salesman;

  @Column()
  orgTrx: string;

  @Column()
  salesmanId: string;

  @Column({ default: 0 })
  creditLimit: number;

  @Column()
  categoryId: string;

  @Column()
  paymentTerm: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}