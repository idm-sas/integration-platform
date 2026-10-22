import { AppDataSource } from '../data-source';
import { PrincipalCategoryAccess } from '../entities/principal-category-access.entity';
import { Principal } from '../entities/principal.entity';
import * as bcrypt from 'bcrypt';
import { In } from 'typeorm';
import { ProductCategory } from '../entities/product-category.entity';

async function seed() {
  await AppDataSource.initialize();

  const principalRepo = AppDataSource.getRepository(Principal);
  const categoryRepo = AppDataSource.getRepository(ProductCategory);
  const accessRepo = AppDataSource.getRepository(PrincipalCategoryAccess);

  const exists = await principalRepo.findOne({
    where: {
      clientId: 'signify',
    },
  });

  if (exists) {
    console.log('Principal already exists');
    process.exit(0);
  }

  const secret = await bcrypt.hash('secret_signify_2026', 12);

   const principals = await principalRepo.save([
    {
        clientId: 'signify',
        clientSecretHash: secret,
        name: 'Signify Indonesia',
        description: 'Signify Indonesia',
        rateLimitRpm: 300,
        isActive: true,
    }
  ]);

  const [pSignify] = principals;

  const requiredCats = ['Philips TR', 'PILA'];
  const categories = await categoryRepo.find({
    where: { name: In(requiredCats) },
  });
  
  // Jadikan map supaya mudah akses by name
  const catMap = new Map(categories.map((c) => [c.name, c]));

  for (const name of requiredCats) {
    if (!catMap.get(name)) throw new Error(`Category "${name}" not found in DB`);
  }

  await accessRepo.save([
    // Signify
    { principalId: pSignify.id, categoryId: catMap.get('Philips TR').id, canRead: true, canReadPrice: true, canSync: false },
    { principalId: pSignify.id, categoryId: catMap.get('PILA').id, canRead: true, canReadPrice: true, canSync: false },
  ]);

  console.log('Principal created.');

  await AppDataSource.destroy();
}

seed();