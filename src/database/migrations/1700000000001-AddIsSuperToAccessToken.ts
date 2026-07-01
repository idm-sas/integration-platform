import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsSuperToAccessToken1700000000001 implements MigrationInterface {
  name = 'AddIsSuperToAccessToken1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // principalId jadi nullable
    await queryRunner.query(`
      ALTER TABLE "access_tokens" 
      ALTER COLUMN "principalId" DROP NOT NULL
    `);

    // Tambah kolom isSuper
    await queryRunner.query(`
      ALTER TABLE "access_tokens" 
      ADD COLUMN IF NOT EXISTS "isSuper" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Hapus dulu semua token super sebelum set NOT NULL
    await queryRunner.query(`
      DELETE FROM "access_tokens" WHERE "isSuper" = true OR "principalId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "access_tokens" DROP COLUMN "isSuper"
    `);

    await queryRunner.query(`
      ALTER TABLE "access_tokens" 
      ALTER COLUMN "principalId" SET NOT NULL
    `);
  }
}