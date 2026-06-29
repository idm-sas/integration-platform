import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_prices')
export class ProductPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (p) => p.prices)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  idempiereId: number;

  /** ID price list dari iDempiere */
  @Column()
  priceListId: number;

  @Column()
  priceListName: string;

  @Column('decimal', { precision: 18, scale: 4 })
  listPrice: number;

  @Column('decimal', { precision: 18, scale: 4 })
  standardPrice: number;

  @Column('decimal', { precision: 18, scale: 4 })
  limitPrice: number;

  @Column({ default: 'IDR' })
  currency: string;

  @Column({ nullable: true })
  validFrom: Date;

  @Column({ nullable: true })
  validTo: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  syncedAt: Date;
}
