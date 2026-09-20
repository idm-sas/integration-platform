import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

@Entity('inventory_stocks')
export class InventoryStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  /** sum(QtyOnHand) — satuan jual */
  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  qtyOnHand: number;

  /** sum(QtyOnHandInUOM) — satuan terkecil */
  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  qtyOnHandInUOM: number;

  @Column({ nullable: true })
  batchNo: string;

  /** DateMaterialPolicy dari m_storageonhand → DateInventory di response */
  @Column({ nullable: true, type: 'date' })
  dateMaterialPolicy: string;

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
