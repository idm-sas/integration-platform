import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizationWarehouse1789722873399 implements MigrationInterface {
    name = 'AddOrganizationWarehouse1789722873399';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "warehouses"
            ADD COLUMN "organization" varchar NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "warehouses"
            DROP COLUMN "organization"
        `);
    }

}
