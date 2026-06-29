import { AppDataSource } from '../data-source';
import { Principal } from '../entities/principal.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { Product } from '../entities/product.entity';
import { ProductPrice } from '../entities/product-price.entity';
import { PrincipalCategoryAccess } from '../entities/principal-category-access.entity';
import * as bcrypt from 'bcrypt';

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding database...');

  const categoryRepo = AppDataSource.getRepository(ProductCategory);
  const productRepo = AppDataSource.getRepository(Product);
  const priceRepo = AppDataSource.getRepository(ProductPrice);
  const principalRepo = AppDataSource.getRepository(Principal);
  const accessRepo = AppDataSource.getRepository(PrincipalCategoryAccess);

  // ── 1. Product Categories ──────────────────────────────────
  const categories = await categoryRepo.save([
    { idempiereId: 1001, code: 'ELECTRONICS', name: 'Electronics', isActive: true },
    { idempiereId: 1002, code: 'FOOD_BEVERAGE', name: 'Food & Beverage', isActive: true },
    { idempiereId: 1003, code: 'PHARMA', name: 'Pharmaceutical', isActive: true },
    { idempiereId: 1004, code: 'FMCG', name: 'FMCG', isActive: true },
  ]);
  console.log(`✅ Categories: ${categories.length} seeded`);

  const [catElec, catFood, catPharma, catFmcg] = categories;

  // ── 2. Products ────────────────────────────────────────────
  const products = await productRepo.save([
    // Electronics
    { idempiereId: 2001, code: 'PROD-ELEC-001', name: 'Smartphone A1', uom: 'Unit', categoryId: catElec.id, isActive: true, syncedAt: new Date() },
    { idempiereId: 2002, code: 'PROD-ELEC-002', name: 'Laptop Pro X', uom: 'Unit', categoryId: catElec.id, isActive: true, syncedAt: new Date() },
    { idempiereId: 2003, code: 'PROD-ELEC-003', name: 'Wireless Earbuds', uom: 'Pcs', categoryId: catElec.id, isActive: true, syncedAt: new Date() },
    // Food & Beverage
    { idempiereId: 2004, code: 'PROD-FOOD-001', name: 'Mineral Water 600ml', uom: 'Btl', categoryId: catFood.id, isActive: true, syncedAt: new Date() },
    { idempiereId: 2005, code: 'PROD-FOOD-002', name: 'Instant Noodle Original', uom: 'Pcs', categoryId: catFood.id, isActive: true, syncedAt: new Date() },
    { idempiereId: 2006, code: 'PROD-FOOD-003', name: 'Green Tea 250ml', uom: 'Btl', categoryId: catFood.id, isActive: true, syncedAt: new Date() },
    // Pharma
    { idempiereId: 2007, code: 'PROD-PHRM-001', name: 'Paracetamol 500mg', uom: 'Tab', categoryId: catPharma.id, isActive: true, syncedAt: new Date() },
    { idempiereId: 2008, code: 'PROD-PHRM-002', name: 'Vitamin C 1000mg', uom: 'Tab', categoryId: catPharma.id, isActive: true, syncedAt: new Date() },
    // FMCG
    { idempiereId: 2009, code: 'PROD-FMCG-001', name: 'Shampoo Anti-Dandruff', uom: 'Btl', categoryId: catFmcg.id, isActive: true, syncedAt: new Date() },
    { idempiereId: 2010, code: 'PROD-FMCG-002', name: 'Body Lotion 200ml', uom: 'Btl', categoryId: catFmcg.id, isActive: true, syncedAt: new Date() },
  ]);
  console.log(`✅ Products: ${products.length} seeded`);

  // ── 3. Product Prices ──────────────────────────────────────
  const priceData: Partial<ProductPrice>[] = [];
  for (const product of products) {
    // Price List 1: Retail
    priceData.push({
      productId: product.id,
      idempiereId: product.idempiereId * 10 + 1,
      priceListId: 101,
      priceListName: 'Retail Price',
      listPrice: Math.round(Math.random() * 900000 + 10000),
      standardPrice: Math.round(Math.random() * 800000 + 9000),
      limitPrice: Math.round(Math.random() * 700000 + 8000),
      currency: 'IDR',
      isActive: true,
      syncedAt: new Date(),
    });
    // Price List 2: Wholesale
    priceData.push({
      productId: product.id,
      idempiereId: product.idempiereId * 10 + 2,
      priceListId: 102,
      priceListName: 'Wholesale Price',
      listPrice: Math.round(Math.random() * 800000 + 8000),
      standardPrice: Math.round(Math.random() * 700000 + 7000),
      limitPrice: Math.round(Math.random() * 600000 + 6000),
      currency: 'IDR',
      isActive: true,
      syncedAt: new Date(),
    });
  }
  await priceRepo.save(priceData);
  console.log(`✅ Prices: ${priceData.length} seeded`);

  // ── 4. Principals ──────────────────────────────────────────
  const secret1 = await bcrypt.hash('secret_principal_alpha_2024', 10);
  const secret2 = await bcrypt.hash('secret_principal_beta_2024', 10);
  const secret3 = await bcrypt.hash('secret_principal_gamma_2024', 10);

  const principals = await principalRepo.save([
    {
      clientId: 'principal_alpha',
      clientSecretHash: secret1,
      name: 'Principal Alpha (Electronics)',
      description: 'Hanya akses Electronics',
      rateLimitRpm: 60,
      isActive: true,
    },
    {
      clientId: 'principal_beta',
      clientSecretHash: secret2,
      name: 'Principal Beta (Food & FMCG)',
      description: 'Akses Food & Beverage dan FMCG termasuk harga',
      rateLimitRpm: 100,
      isActive: true,
    },
    {
      clientId: 'principal_gamma',
      clientSecretHash: secret3,
      name: 'Principal Gamma (All Access)',
      description: 'Akses semua category',
      rateLimitRpm: 200,
      isActive: true,
    },
  ]);
  console.log(`✅ Principals: ${principals.length} seeded`);

  const [pAlpha, pBeta, pGamma] = principals;

  // ── 5. Principal Category Access Mapping ───────────────────
  await accessRepo.save([
    // Alpha: hanya Electronics, tanpa harga
    { principalId: pAlpha.id, categoryId: catElec.id, canRead: true, canReadPrice: false, canSync: false },
    // Beta: Food + FMCG, dengan harga
    { principalId: pBeta.id, categoryId: catFood.id, canRead: true, canReadPrice: true, canSync: false },
    { principalId: pBeta.id, categoryId: catFmcg.id, canRead: true, canReadPrice: true, canSync: false },
    // Gamma: semua, dengan harga
    { principalId: pGamma.id, categoryId: catElec.id, canRead: true, canReadPrice: true, canSync: true },
    { principalId: pGamma.id, categoryId: catFood.id, canRead: true, canReadPrice: true, canSync: true },
    { principalId: pGamma.id, categoryId: catPharma.id, canRead: true, canReadPrice: true, canSync: true },
    { principalId: pGamma.id, categoryId: catFmcg.id, canRead: true, canReadPrice: true, canSync: true },
  ]);
  console.log(`✅ Access mappings seeded`);

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('Credentials untuk testing:');
  console.log('  principal_alpha  / secret_principal_alpha_2024  → Electronics only');
  console.log('  principal_beta   / secret_principal_beta_2024   → Food + FMCG + price');
  console.log('  principal_gamma  / secret_principal_gamma_2024  → All + price');
  console.log('─────────────────────────────────────────────\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
