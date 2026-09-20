import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInventoryStocks1789464780346 implements MigrationInterface {
    name = 'CreateInventoryStocks1789464780346';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "inventory_stocks" (
                "id"             uuid          NOT NULL DEFAULT gen_random_uuid(),
                "productId"      uuid          NOT NULL,
                "warehouseId"    uuid          NOT NULL,
                "qtyOnHand"      numeric(18,4) NOT NULL DEFAULT 0,
                "qtyOnHandInUOM" numeric(18,4) NOT NULL DEFAULT 0,
                "batchNo"        varchar,
                "dateMaterialPolicy"  date,
                "syncedAt"       TIMESTAMP,
                "createdAt"      TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"      TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_inventory_stocks"              PRIMARY KEY ("id"),
                CONSTRAINT "FK_inventory_stocks_product"      FOREIGN KEY ("productId")
                REFERENCES "products"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_inventory_stocks_warehouse"    FOREIGN KEY ("warehouseId")
                REFERENCES "warehouses"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_inventory_stocks_productId"    ON "inventory_stocks" ("productId")`);
        await queryRunner.query(`CREATE INDEX "IDX_inventory_stocks_warehouseId"  ON "inventory_stocks" ("warehouseId")`);
        await queryRunner.query(`CREATE INDEX "IDX_inventory_stocks_qtyOnHand"   ON "inventory_stocks" ("qtyOnHand")`);
        await queryRunner.query(`CREATE INDEX "IDX_inventory_stocks_syncedAt"    ON "inventory_stocks" ("syncedAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_stocks_syncedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_stocks_qtyOnHand"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_stocks_warehouseId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_stocks_productId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "inventory_stocks"`);
    }
}
