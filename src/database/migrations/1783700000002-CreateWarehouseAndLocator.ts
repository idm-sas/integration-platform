import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehouseAndLocator1783700000002 implements MigrationInterface {
  name = 'CreateWarehouseAndLocator1783700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Warehouses ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id"          uuid      NOT NULL DEFAULT gen_random_uuid(),
        "idempiereId" integer   NOT NULL,
        "value"       varchar   NOT NULL,
        "name"        varchar   NOT NULL,
        "description" varchar,
        "isActive"    boolean   NOT NULL DEFAULT true,
        "syncedAt"    TIMESTAMP,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_warehouses_idempiereId" UNIQUE ("idempiereId"),
        CONSTRAINT "UQ_warehouses_value"       UNIQUE ("value"),
        CONSTRAINT "PK_warehouses"             PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_warehouses_isActive"  ON "warehouses" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_warehouses_syncedAt"  ON "warehouses" ("syncedAt")`);

    // ── Locators ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "locators" (
        "id"          uuid      NOT NULL DEFAULT gen_random_uuid(),
        "idempiereId" integer   NOT NULL,
        "warehouseId" uuid      NOT NULL,
        "value"       varchar   NOT NULL,
        "aisle"       varchar,
        "bin"         varchar,
        "level"       varchar,
        "priorityNo"  integer   NOT NULL DEFAULT 0,
        "isDefault"   boolean   NOT NULL DEFAULT false,
        "isActive"    boolean   NOT NULL DEFAULT true,
        "syncedAt"    TIMESTAMP,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_locators_idempiereId"   UNIQUE ("idempiereId"),
        CONSTRAINT "PK_locators"               PRIMARY KEY ("id"),
        CONSTRAINT "FK_locators_warehouse"     FOREIGN KEY ("warehouseId")
          REFERENCES "warehouses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_locators_warehouseId" ON "locators" ("warehouseId")`);
    await queryRunner.query(`CREATE INDEX "IDX_locators_isActive"    ON "locators" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_locators_isDefault"   ON "locators" ("isDefault")`);
    await queryRunner.query(`CREATE INDEX "IDX_locators_syncedAt"    ON "locators" ("syncedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_locators_syncedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_locators_isDefault"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_locators_isActive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_locators_warehouseId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locators"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_warehouses_syncedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_warehouses_isActive"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouses"`);
  }
}
