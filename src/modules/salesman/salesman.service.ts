import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../../auth/token.service';
import { Salesman } from 'src/database/entities/salesman.entity';

@Injectable()
export class SalesmanService {
  constructor(
    @InjectRepository(Salesman)
    private salesmanRepo: Repository<Salesman>,
  ) {}

  /** Tampilkan hanya salesman yang diizinkan sesuai scope token */
  async findAccessible(principal: JwtPayload) {
    const allowedCodes = this.extractCategoryCodesFromScopes(principal.scopes);

    const qb = this.salesmanRepo
      .createQueryBuilder('salesman')
      .where('salesman.isActive = true')
      .where('salesman.bpGroup = :bpGroup', { bpGroup: 'SALES SIGNIFY' })
      .orderBy('salesman.name', 'ASC');

    if (allowedCodes !== null && allowedCodes.length > 0) {
      qb.andWhere('LOWER(salesman.code) IN (:...codes)', {
        codes: allowedCodes.map((c) => c.toLowerCase()),
      });
    }

    const salesmans = await qb.getMany();

    return salesmans.map((s) => ({
      id: s.id,
      name: s.name,
      name2: s.name2,
      isActive: s.isActive,
      email: s.email,
      phone: s.phone,
      position: s.position,
      positionCodeLevel: s.positionCodeLevel,
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
