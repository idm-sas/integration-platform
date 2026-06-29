import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Principal } from './principal.entity';
import { ProductCategory } from './product-category.entity';

@Entity('principal_category_access')
export class PrincipalCategoryAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  principalId: string;

  @ManyToOne(() => Principal, (p) => p.categoryAccesses)
  @JoinColumn({ name: 'principalId' })
  principal: Principal;

  @Column()
  categoryId: string;

  @ManyToOne(() => ProductCategory, (c) => c.principalAccesses)
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory;

  @Column({ default: true })
  canRead: boolean;

  @Column({ default: false })
  canSync: boolean;

  @Column({ default: false })
  canReadPrice: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
