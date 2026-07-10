import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRetailersMaster1783672517005 implements MigrationInterface {
    name = 'CreateRetailersMaster1783672517005';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "retailers" (
                "id"                uuid        NOT NULL DEFAULT gen_random_uuid(),
                "idempiereId"       integer     NOT NULL,
                "value"             varchar     NOT NULL,
                "name"              varchar     NOT NULL,
                "name2"             varchar,
                "bpGroup"           varchar,
                "location"          varchar     NOT NULL,
                "address"           varchar,
                "marketname"        varchar,
                "city"              varchar,
                "subcity"           varchar,
                "region"            varchar,
                "country"           varchar,
                "postal"            varchar,
                "arcode"            varchar,
                "isCustomer"        boolean     NOT NULL DEFAULT false,
                "isActive"          boolean     NOT NULL DEFAULT true,
                "syncedAt"          TIMESTAMP,
                "createdAt"         TIMESTAMP   NOT NULL DEFAULT now(),
                "updatedAt"         TIMESTAMP   NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_retailers_idempiereId" UNIQUE ("idempiereId"),
                CONSTRAINT "UQ_retailers_value"       UNIQUE ("value"),
                CONSTRAINT "PK_retailers"             PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_retailers_isActive"  ON "retailers" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_retailers_bpGroup"   ON "retailers" ("bpGroup")`);
        await queryRunner.query(`CREATE INDEX "IDX_retailers_syncedAt"  ON "retailers" ("syncedAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retailers_syncedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retailers_bpGroup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retailers_isActive"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "retailers"`);
    }

}
