import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeIsSoTrxToBoolean1792466734198 implements MigrationInterface {
    name = 'ChangeIsSoTrxToBoolean1792466734198';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "invoice_headers"
            DROP CONSTRAINT "CHK_invoice_headers_issotrx",
            ALTER COLUMN "issotrx" DROP DEFAULT
        `);

        await queryRunner.query(`
            ALTER TABLE "invoice_headers"
            ALTER COLUMN "issotrx" TYPE boolean USING ("issotrx" = 'Y'),
            ALTER COLUMN "issotrx" SET DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "invoice_headers"
            ALTER COLUMN "issotrx" DROP DEFAULT
        `);

        // Kembalikan boolean menjadi Y/N.
        await queryRunner.query(`
            ALTER TABLE "invoice_headers"
            ALTER COLUMN "issotrx" TYPE character(1)
            USING (
                CASE WHEN "issotrx" THEN 'Y' ELSE 'N' END
            )::character(1)
        `);

        // Pulihkan default dan constraint awal.
        await queryRunner.query(`
            ALTER TABLE "invoice_headers"
            ALTER COLUMN "issotrx" SET DEFAULT 'N',
            ADD CONSTRAINT "CHK_invoice_headers_issotrx"
                CHECK ("issotrx" IN ('Y', 'N'))
        `);
    }

}
