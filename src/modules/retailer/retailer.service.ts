import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../../auth/token.service';
import { Salesman } from 'src/database/entities/salesman.entity';
import { Retailer } from 'src/database/entities/retailers.entity';

@Injectable()
export class RetailerService {
  constructor(
    @InjectRepository(Retailer)
    private retailerRepo: Repository<Retailer>,
  ) {}

  /** Tampilkan hanya retailer yang diizinkan sesuai scope token */
  async findAccessible(principal: JwtPayload) {
    const allowedCodes = this.extractCategoryCodesFromScopes(principal.scopes);

    const qb = this.retailerRepo
      .createQueryBuilder('retailers')
      .where('retailers.isActive = true')
      .where('retailers.value IN (:...codes)', {
        codes: ['00022', '01983']
      })
      .orderBy('retailers.name', 'ASC');

    // if (allowedCodes !== null && allowedCodes.length > 0) {
    //   qb.andWhere('LOWER(retailers.value) IN (:...codes)', {
    //     codes: allowedCodes.map((c) => c.toLowerCase()),
    //   });
    // }

    const retailers = await qb.getMany();

    return retailers.map((s) => ({
      id: s.id,
      value: s.value,
      name: s.name,
      name2: s.name2 ?? null,
      bpGroup: s.bpGroup ?? null,
      location: s.location ?? null,
      address: s.address ?? null,
      marketname: s.marketname ?? null,
      city: s.city ?? null,
      subcity: s.subcity ?? null,
      region: s.region ?? null,
      country: s.country ?? null,
      postal: s.postal ?? null,
      arcode: s.arcode ?? null,
      isActive: s.isActive,
      syncedAt: s.syncedAt,
    }));
  }

  private extractCategoryCodesFromScopes(scopes: string[]): string[] | null {
    const codes: string[] = [];
    for (const scope of scopes) {
      if (scope.includes(':*')) return null;
      const match = scope.match(/^(?:product|price):(?:read|sync):(.+)$/);
      if (match && !codes.includes(match[1])) codes.push(match[1]);
    }
    return codes;
  }
}
