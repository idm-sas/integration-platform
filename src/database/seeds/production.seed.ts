import { AppDataSource } from '../data-source';
import { Principal } from '../entities/principal.entity';
import * as bcrypt from 'bcrypt';

async function seed() {
  await AppDataSource.initialize();

  const principalRepo = AppDataSource.getRepository(Principal);

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
  const hash = await bcrypt.hash(secret, 12);

  await principalRepo.save({
    clientId: 'signify',
    clientSecretHash: hash,
    name: 'Signify Indonesia',
    description: 'Signify Indonesia',
    rateLimitRpm: 300,
    isActive: true,
  });

  console.log('Principal created.');

  await AppDataSource.destroy();
}

seed();