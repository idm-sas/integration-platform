import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StockTransferLine } from './stock-transfer-line.entity';

@Entity('stock_transfers')
@Index('IDX_stock_transfers_organization', ['organization'])
@Index('IDX_stock_transfers_sellerErpId', ['sellerErpId'])
@Index('IDX_stock_transfers_movementDate', ['movementDate'])
@Index('UQ_stock_transfers_documentNo', ['documentNo'], { unique: true })
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_stock_transfers',
  })
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  organization!: string;

  @Column({ type: 'varchar', length: 60 })
  sellerErpId!: string;

  @Column({ type: 'date' })
  movementDate!: string;

  @Column({ type: 'varchar', length: 60 })
  documentNo!: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalValue!: string;

  @Column({ type: 'text', nullable: true })
  remark!: string | null;

  @Column({ type: 'integer' })
  c_doctype_id!: number;

  @Column({ type: 'varchar', length: 10 })
  status!: string;

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

  @OneToMany(
    () => StockTransferLine,
    (line) => line.stockTransfer,
  )
  lines!: StockTransferLine[];
}