import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldBPReplacement1792143327700 implements MigrationInterface {
    name = 'AddFieldBPReplacement1792143327700';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "retailers"
            ADD COLUMN "isBPReplacement" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_retailers_isBPReplacement"
            ON "retailers" ("isBPReplacement")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_retailers_isBPReplacement"
        `);

        await queryRunner.query(`
            ALTER TABLE "retailers"
            DROP COLUMN "isBPReplacement"
        `);
    }
}
