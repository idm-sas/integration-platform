import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStockTransfer1792489896198 implements MigrationInterface {
    name = 'CreateStockTransfer1792489896198';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "stock_transfers" (
                "id"                        uuid            NOT NULL DEFAULT gen_random_uuid(),
                "organization"              varchar(60)     NOT NULL,
                "sellerErpId"               varchar(60)     NOT NULL,
                "movementDate"              date            NOT NULL,
                "documentNo"                varchar(60)     NOT NULL,
                "totalValue"                numeric(18,2)   NOT NULL DEFAULT 0,
                "remark"                    text,
                "c_doctype_id"              integer         NOT NULL,
                "status"                    varchar(10)     NOT NULL,
                "createdAt"                 TIMESTAMP       NOT NULL DEFAULT now(),
                "updatedAt"                 TIMESTAMP       NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_transfers" PRIMARY KEY ("id")
            )
        `);       

        await queryRunner.query(`CREATE INDEX "IDX_stock_transfers_organization" ON "stock_transfers" ("organization")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_transfers_sellerErpId" ON "stock_transfers" ("sellerErpId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_transfers_movementDate" ON "stock_transfers" ("movementDate")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_transfers_documentNo" ON "stock_transfers" ("documentNo")`);

        await queryRunner.query(`
            CREATE TABLE "stock_transfer_lines" (
                "id"                        uuid          NOT NULL DEFAULT gen_random_uuid(),
                "stockTransferId"           uuid          NOT NULL,
                "productId"                 uuid          NOT NULL,
                "locatorErpId"              uuid          NOT NULL,
                "locatorToErpId"            uuid          NOT NULL,
                "ActualReceiveStockQty"     numeric(18,6) NOT NULL,
                "createdAt"                 TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"                 TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_transfer_lines" PRIMARY KEY ("id"),
                CONSTRAINT "FK_stock_transfer_lines_header" FOREIGN KEY ("stockTransferId") REFERENCES "stock_transfers" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_transfer_lines_product" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_transfer_lines_locator" FOREIGN KEY ("locatorErpId") REFERENCES "locators" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_transfer_lines_locatorTo" FOREIGN KEY ("locatorToErpId") REFERENCES "locators" ("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_lines_header" ON "stock_transfer_lines" ("stockTransferId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_lines_product" ON "stock_transfer_lines" ("productId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_lines_locator" ON "stock_transfer_lines" ("locatorErpId")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_transfer_lines_locatorTo" ON "stock_transfer_lines" ("locatorToErpId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfer_lines"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfers"`);
    }
}
