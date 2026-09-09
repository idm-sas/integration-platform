import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRetailerSyncFlags1788973963198 implements MigrationInterface {
    name = 'AddRetailerSyncFlags1788973963198';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "retailers"
            ADD COLUMN "isSyncToIntegration" boolean NOT NULL DEFAULT false,
            ADD COLUMN "isShipTo" boolean NOT NULL DEFAULT false,
            ADD COLUMN "isBillTo" boolean NOT NULL DEFAULT false,
            ADD COLUMN "isMainArcode" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_retailers_isSyncToIntegration"
            ON "retailers" ("isSyncToIntegration")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_retailers_isSyncToIntegration"
        `);

        await queryRunner.query(`
            ALTER TABLE "retailers"
            DROP COLUMN "isMainArcode",
            DROP COLUMN "isBillTo",
            DROP COLUMN "isShipTo",
            DROP COLUMN "isSyncToIntegration"
        `);
    }

}
