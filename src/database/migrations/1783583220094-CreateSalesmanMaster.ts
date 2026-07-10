import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSalesmanMaster1783583220094 implements MigrationInterface {
    name = 'CreateSalesmanMaster1783583220094';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "salesman" (
                "id"                uuid        NOT NULL DEFAULT gen_random_uuid(),
                "idempiereId"       integer     NOT NULL,
                "value"             varchar     NOT NULL,
                "name"              varchar     NOT NULL,
                "name2"             varchar,
                "email"             varchar,
                "phone"             varchar,
                "position"          varchar,
                "positionCodeLevel" varchar,
                "bpGroup"           varchar,
                "isActive"          boolean     NOT NULL DEFAULT true,
                "syncedAt"          TIMESTAMP,
                "createdAt"         TIMESTAMP   NOT NULL DEFAULT now(),
                "updatedAt"         TIMESTAMP   NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_salesman_idempiereId" UNIQUE ("idempiereId"),
                CONSTRAINT "UQ_salesman_value"       UNIQUE ("value"),
                CONSTRAINT "PK_salesman"             PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_salesman_isActive"  ON "salesman" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_salesman_bpGroup"   ON "salesman" ("bpGroup")`);
        await queryRunner.query(`CREATE INDEX "IDX_salesman_syncedAt"  ON "salesman" ("syncedAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_salesman_syncedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_salesman_bpGroup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_salesman_isActive"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "salesman"`);
    }

}
