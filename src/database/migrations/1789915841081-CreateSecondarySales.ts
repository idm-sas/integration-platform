import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSecondarySales1789915841081 implements MigrationInterface {
    name = 'CreateSecondarySales1789915841081';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── invoice_headers ───────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "invoice_headers" (
                "id"                        uuid            NOT NULL DEFAULT gen_random_uuid(),
                "organization"              varchar(60)     NOT NULL,
                "sellerErpId"               varchar(60)     NOT NULL,
                "orderNo"                   varchar(60),
                "invoiceDate"               date            NOT NULL,
                "invoiceNo"                 varchar(60)     NOT NULL,
                "warehouseErpId"            uuid            NOT NULL,
                "totalGrossValue"           numeric(18,2)   NOT NULL DEFAULT 0,
                "status"                    varchar(10)     NOT NULL,
                "totalDiscount"             numeric(18,2)   NOT NULL DEFAULT 0,
                "totalCashDiscountValue"    numeric(18,2)   NOT NULL DEFAULT 0,
                "totalNetValue"             numeric(18,2)   NOT NULL DEFAULT 0,
                "taxPercent"                numeric(5,2)    NOT NULL DEFAULT 0,
                "taxValue"                  numeric(18,2)   NOT NULL DEFAULT 0,
                "totalValue"                numeric(18,2)   NOT NULL DEFAULT 0,
                "remark"                    text,
                "retailerErpId"             uuid            NOT NULL,
                "esmId"                     uuid            NOT NULL,
                "issotrx"                   char(1)         NOT NULL DEFAULT 'N',
                "c_doctype_id"              integer         NOT NULL,
                "createdAt"                 TIMESTAMP       NOT NULL DEFAULT now(),
                "updatedAt"                 TIMESTAMP       NOT NULL DEFAULT now(),
                CONSTRAINT "PK_invoice_headers" PRIMARY KEY ("id"),
                CONSTRAINT "FK_invoice_warehouses" FOREIGN KEY ("warehouseErpId") REFERENCES "warehouses"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_invoice_retailer" FOREIGN KEY ("retailerErpId") REFERENCES "retailers"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_invoice_salesman" FOREIGN KEY ("esmId") REFERENCES "salesman"("id") ON DELETE CASCADE,
                CONSTRAINT "CHK_invoice_headers_issotrx" CHECK ("issotrx" IN ('Y', 'N'))
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_invoice_headers_organization" ON "invoice_headers" ("organization")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_headers_sellerErpId" ON "invoice_headers" ("sellerErpId")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_headers_invoiceDate" ON "invoice_headers" ("invoiceDate")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoice_headers_invoiceNo" ON "invoice_headers" ("invoiceNo")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_headers_warehouseErpId" ON "invoice_headers" ("warehouseErpId")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_headers_retailerErpId" ON "invoice_headers" ("retailerErpId")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_headers_esmId" ON "invoice_headers" ("esmId")`);

        // ── invoice_lines ─────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "invoice_lines" (
                "id"                uuid            NOT NULL DEFAULT gen_random_uuid(),
                "invoiceHeaderId"   uuid            NOT NULL,
                "productId"         uuid            NOT NULL,
                "grossValue"        numeric(18,2)   NOT NULL DEFAULT 0,
                "netValue"          numeric(18,2)   NOT NULL DEFAULT 0,
                "price"             numeric(18,2)   NOT NULL DEFAULT 0,
                "discount1Code"     varchar(60),
                "discount1Percent"  numeric(7,4)    NOT NULL DEFAULT 0,
                "freeQty"           numeric(18,4)   NOT NULL DEFAULT 0,
                "invoicedQuantity"  numeric(18,4)   NOT NULL DEFAULT 0,
                "uom"               varchar(20)     NOT NULL,
                "description"       text,
                "createdAt"         TIMESTAMP       NOT NULL DEFAULT now(),
                "updatedAt"         TIMESTAMP       NOT NULL DEFAULT now(),
                CONSTRAINT "PK_invoice_lines" PRIMARY KEY ("id"),
                CONSTRAINT "FK_invoice_lines_header" FOREIGN KEY ("invoiceHeaderId") REFERENCES "invoice_headers"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_invoice_lines_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_invoice_lines_invoiceHeaderId" ON "invoice_lines" ("invoiceHeaderId")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_lines_productId" ON "invoice_lines" ("productId")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_lines_header_product" ON "invoice_lines" ("invoiceHeaderId", "productId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "invoice_lines"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "invoice_headers"`);
    }
}