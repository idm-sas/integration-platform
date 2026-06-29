import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { ProductPrice } from './product-price.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  idempiereId: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  uom: string;

  @Column({ nullable: true })
  uomId: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @Column('jsonb', { nullable: true })
  additionalAttributes: Record<string, any>;

  @Column({ nullable: true })
  group2: string;

  @Column()
  categoryId: string;

  @ManyToOne(() => ProductCategory, (cat) => cat.products)
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory;

  @OneToMany(() => ProductPrice, (pp) => pp.product)
  prices: ProductPrice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  syncedAt: Date;
}
