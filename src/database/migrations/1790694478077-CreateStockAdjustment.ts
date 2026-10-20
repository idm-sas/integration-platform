import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStockAdjustment1790694478077 implements MigrationInterface {
    name = 'CreateStockAdjustment1790694478077';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "stock_adjustments" (
                "id"                        uuid            NOT NULL DEFAULT gen_random_uuid(),
                "organization"              varchar(60)     NOT NULL,
                "sellerErpId"               varchar(60)     NOT NULL,
                "movementDate"              date            NOT NULL,
                "documentNo"                varchar(60)     NOT NULL,
                "warehouseErpId"            uuid            NOT NULL,
                "totalValue"                numeric(18,2)   NOT NULL DEFAULT 0,
                "remark"                    text,
                "c_doctype_id"              integer         NOT NULL,
                "status"                    varchar(10)     NOT NULL,
                "createdAt"                 TIMESTAMP       NOT NULL DEFAULT now(),
                "updatedAt"                 TIMESTAMP       NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_adjustments" PRIMARY KEY ("id"),
                CONSTRAINT "FK_stock_adjustments_warehouse" FOREIGN KEY ("warehouseErpId") REFERENCES "warehouses" ("id") ON DELETE CASCADE
            )
        `);       

        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustments_organization" ON "stock_adjustments" ("organization")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustments_sellerErpId" ON "stock_adjustments" ("sellerErpId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustments_movementDate" ON "stock_adjustments" ("movementDate")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_adjustments_documentNo" ON "stock_adjustments" ("documentNo")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustments_warehouseErpId" ON "stock_adjustments" ("warehouseErpId")`);

        await queryRunner.query(`
            CREATE TABLE "stock_adjustment_lines" (
                "id"                        uuid          NOT NULL DEFAULT gen_random_uuid(),
                "stockAdjustmentId"         uuid          NOT NULL,
                "productId"                 uuid          NOT NULL,
                "locatorErpId"              uuid          NOT NULL,
                "stockQuantityInStdUnit"    numeric(18,6) NOT NULL,
                "stockQuantityInUnitOld"    numeric(18,6) NOT NULL,
                "stockQuantityInUnitNew"    numeric(18,6) NOT NULL,
                "createdAt"                 TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"                 TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_adjustment_lines" PRIMARY KEY ("id"),
                CONSTRAINT "FK_stock_adjustment_lines_header" FOREIGN KEY ("stockAdjustmentId") REFERENCES "stock_adjustments" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_adjustment_lines_product" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_adjustment_lines_locator" FOREIGN KEY ("locatorErpId") REFERENCES "locators" ("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustments_warehouse_date" ON "stock_adjustments" ("warehouseErpId", "movementDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustment_lines_header" ON "stock_adjustment_lines" ("stockAdjustmentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_adjustment_lines_product" ON "stock_adjustment_lines" ("productId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_adjustment_lines"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_adjustments"`);
    }

}
