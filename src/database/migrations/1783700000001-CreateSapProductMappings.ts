import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSapProductMappings1783700000001 implements MigrationInterface {
  name = 'CreateSapProductMappings1783700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sap_product_mappings" (
        "id"             uuid      NOT NULL DEFAULT gen_random_uuid(),
        "productId"      uuid      NOT NULL,
        "sapProductCode" varchar   NOT NULL,
        "description"    varchar,
        "isActive"       boolean   NOT NULL DEFAULT true,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sap_product_mappings_sapCode"    UNIQUE ("sapProductCode"),
        CONSTRAINT "PK_sap_product_mappings"            PRIMARY KEY ("id"),
        CONSTRAINT "FK_sap_product_mappings_product"    FOREIGN KEY ("productId")
          REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sap_product_mappings_productId" ON "sap_product_mappings" ("productId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sap_product_mappings_isActive" ON "sap_product_mappings" ("isActive")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sap_product_mappings_isActive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sap_product_mappings_productId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sap_product_mappings"`);
  }
}
