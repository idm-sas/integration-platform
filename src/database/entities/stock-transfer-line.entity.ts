import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StockTransfer } from './stock-transfer.entity';

// Sesuaikan dengan lokasi entity pada project.
import { Product } from './product.entity';
import { Locator } from './locator.entity';

@Entity('stock_transfer_lines')
@Index('IDX_stock_transfer_lines_header', ['stockTransferId'])
@Index('IDX_stock_transfer_lines_product', ['productId'])
@Index('IDX_stock_transfer_lines_locator', ['locatorErpId'])
@Index('IDX_stock_transfer_lines_locatorTo', ['locatorToErpId'])
export class StockTransferLine {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_stock_transfer_lines',
  })
  id!: string;

  @Column({ type: 'uuid' })
  stockTransferId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid' })
  locatorErpId!: string;

  @Column({ type: 'uuid' })
  locatorToErpId!: string;

  @Column({
    name: 'ActualReceiveStockQty',
    type: 'numeric',
    precision: 18,
    scale: 6,
  })
  ActualReceiveStockQty!: string;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'now()',
  })
  updatedAt!: Date;

  @ManyToOne(
    () => StockTransfer,
    (stockTransfer) => stockTransfer.lines,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'stockTransferId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_transfer_lines_header',
  })
  stockTransfer!: StockTransfer;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'productId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_transfer_lines_product',
  })
  product!: Product;

  @ManyToOne(() => Locator, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'locatorErpId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_transfer_lines_locator',
  })
  locator!: Locator;

  @ManyToOne(() => Locator, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'locatorToErpId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_transfer_lines_locatorTo',
  })
  locatorTo!: Locator;
}