import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRetailersRuleMaster1787570036119 implements MigrationInterface {
    name = 'CreateRetailersRuleMaster1787570036119';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "retailer_rules" (
                "id"            uuid    NOT NULL DEFAULT gen_random_uuid(),
                "idempiereId"   integer NOT NULL,
                "retailerId"    uuid NOT NULL,
                "orgTrx"        varchar NOT NULL,
                "salesmanId"    uuid NOT NULL,
                "creditLimit"   numeric NOT NULL DEFAULT 0,
                "categoryId"    uuid NOT NULL,
                "paymentTerm"   varchar NOT NULL,
                "isActive"      boolean NOT NULL DEFAULT true,
                "syncedAt"      TIMESTAMP,
                "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_retailer_rules_idempiereId"   UNIQUE ("idempiereId"),
                CONSTRAINT "PK_retailer_rules"               PRIMARY KEY ("id"),
                CONSTRAINT "FK_retailer_rules_retailer"      FOREIGN KEY ("retailerId")
                    REFERENCES "retailers"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_retailer_rules_salesman"      FOREIGN KEY ("salesmanId")
                    REFERENCES "salesman"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_retailer_rules_category"      FOREIGN KEY ("categoryId")
                    REFERENCES "product_categories"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_retailer_rules_isActive"  ON "retailer_rules" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_retailer_rules_syncedAt"  ON "retailer_rules" ("syncedAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retailer_rules_syncedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retailer_rules_isActive"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "retailer_rules"`);
    }
}
