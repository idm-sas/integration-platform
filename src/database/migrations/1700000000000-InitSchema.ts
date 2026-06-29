import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "principals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "clientId" character varying NOT NULL,
        "clientSecretHash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "rateLimitRpm" integer NOT NULL DEFAULT 60,
        "rateLimitBurst" integer NOT NULL DEFAULT 10,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_principals_clientId" UNIQUE ("clientId"),
        CONSTRAINT "PK_principals" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "idempiereId" integer NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "parentId" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "syncedAt" TIMESTAMP,
        CONSTRAINT "UQ_product_categories_idempiereId" UNIQUE ("idempiereId"),
        CONSTRAINT "UQ_product_categories_code" UNIQUE ("code"),
        CONSTRAINT "PK_product_categories" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "idempiereId" integer NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "uom" character varying,
        "uomId" integer,
        "isActive" boolean NOT NULL DEFAULT true,
        "imageUrl" character varying,
        "additionalAttributes" jsonb,
        "categoryId" uuid NOT NULL,
        "group2" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "syncedAt" TIMESTAMP,
        CONSTRAINT "UQ_products_idempiereId" UNIQUE ("idempiereId"),
        CONSTRAINT "UQ_products_code" UNIQUE ("code"),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_category" FOREIGN KEY ("categoryId")
          REFERENCES "product_categories"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_prices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "productId" uuid NOT NULL,
        "idempiereId" integer NOT NULL,
        "priceListId" integer NOT NULL,
        "priceListName" character varying NOT NULL,
        "listPrice" numeric(18,4) NOT NULL,
        "standardPrice" numeric(18,4) NOT NULL,
        "limitPrice" numeric(18,4) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'IDR',
        "validFrom" TIMESTAMP,
        "validTo" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "syncedAt" TIMESTAMP,
        CONSTRAINT "PK_product_prices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_prices_product" FOREIGN KEY ("productId")
          REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "principal_category_access" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "principalId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "canRead" boolean NOT NULL DEFAULT true,
        "canSync" boolean NOT NULL DEFAULT false,
        "canReadPrice" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_principal_category_access" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pca_principal" FOREIGN KEY ("principalId")
          REFERENCES "principals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pca_category" FOREIGN KEY ("categoryId")
          REFERENCES "product_categories"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "access_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "principalId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "scopes" text NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_access_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_access_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_access_tokens_principal" FOREIGN KEY ("principalId")
          REFERENCES "principals"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "api_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "principalId" uuid,
        "method" character varying NOT NULL,
        "endpoint" character varying NOT NULL,
        "queryParams" character varying,
        "requestBody" character varying,
        "statusCode" integer NOT NULL,
        "durationMs" integer NOT NULL,
        "ipAddress" character varying,
        "userAgent" character varying,
        "errorMessage" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_principal" FOREIGN KEY ("principalId")
          REFERENCES "principals"("id") ON DELETE SET NULL
      )
    `);

    // Indexes untuk performa query
    await queryRunner.query(`CREATE INDEX "IDX_products_categoryId" ON "products" ("categoryId")`);
    await queryRunner.query(`CREATE INDEX "IDX_products_isActive" ON "products" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_product_prices_productId" ON "product_prices" ("productId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pca_principalId" ON "principal_category_access" ("principalId")`);
    await queryRunner.query(`CREATE INDEX "IDX_access_tokens_hash" ON "access_tokens" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_access_tokens_expiresAt" ON "access_tokens" ("expiresAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "api_audit_logs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "api_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "principal_category_access"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_prices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "principals"`);
  }
}
