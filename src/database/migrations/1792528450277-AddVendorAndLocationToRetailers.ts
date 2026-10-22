import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVendorAndLocationToRetailers1792528450277 implements MigrationInterface {
    name = 'AddVendorAndLocationToRetailers1792528450277';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "retailers"
                ADD COLUMN "isVendor" boolean NOT NULL DEFAULT false,
                ADD COLUMN "locationIdempiereId" integer,
                ADD COLUMN "isLocationActive" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "retailers"
                DROP COLUMN "isLocationActive",
                DROP COLUMN "locationIdempiereId",
                DROP COLUMN "isVendor"
        `);
    }

}
