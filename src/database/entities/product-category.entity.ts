import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Product } from './product.entity';
import { PrincipalCategoryAccess } from './principal-category-access.entity';

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID dari iDempiere */
  @Column({ unique: true })
  idempiereId: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  parentId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  syncedAt: Date;

  @OneToMany(() => Product, (p) => p.category)
  products: Product[];

  @OneToMany(() => PrincipalCategoryAccess, (pca) => pca.category)
  principalAccesses: PrincipalCategoryAccess[];
}
