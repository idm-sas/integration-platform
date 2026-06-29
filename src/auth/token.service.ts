import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Principal } from '../database/entities/principal.entity';
import { AccessToken } from '../database/entities/access-token.entity';
import { PrincipalCategoryAccess } from '../database/entities/principal-category-access.entity';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SUCCESS_MESSAGE } from 'src/common/constants/http-status.constant';

export interface JwtPayload {
  sub: string;
  principalId: string;
  scopes: string[];
}

@Injectable()
export class TokenService {
  constructor(
    @InjectPinoLogger(TokenService.name)
    private readonly logger: PinoLogger,
    @InjectRepository(Principal)
    private principalRepo: Repository<Principal>,
    @InjectRepository(AccessToken)
    private accessTokenRepo: Repository<AccessToken>,
    @InjectRepository(PrincipalCategoryAccess)
    private accessMappingRepo: Repository<PrincipalCategoryAccess>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateToken(dto: TokenRequestDto) {
    // 1. Validasi principal
    const principal = await this.principalRepo.findOne({
      where: { clientId: dto.clientId, isActive: true },
    });

    if (!principal) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const isSecretValid = await bcrypt.compare(dto.clientSecret, principal.clientSecretHash);
    if (!isSecretValid) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    // 2. Ambil semua category access dari mapping table
    const categoryAccesses = await this.accessMappingRepo.find({
      where: { principalId: principal.id },
      relations: ['category'],
    });

    // 3. Build available scopes dari DB mapping
    const availableScopes: string[] = [];
    for (const access of categoryAccesses) {
      const catCode = access.category.code.toLowerCase();
      if (access.canRead) availableScopes.push(`product:read:${catCode}`);
      if (access.canReadPrice) availableScopes.push(`price:read:${catCode}`);
      if (access.canSync) availableScopes.push(`product:sync:${catCode}`);
    }

    // 4. Filter scope yg diminta vs yg diizinkan
    let grantedScopes: string[];
    if (dto.scopes && dto.scopes.length > 0) {
      grantedScopes = dto.scopes.filter((s) => availableScopes.includes(s));
    } else {
      grantedScopes = availableScopes; // grant semua yg available
    }

    if (grantedScopes.length === 0) {
      throw new UnauthorizedException('No valid scopes available for this principal');
    }

    // 5. Generate JWT
    const expiresIn = this.configService.get<number>('jwt.expiresIn') || 3600;
    const now = Math.floor(Date.now() / 1000);

    const payload: JwtPayload = {
      sub: principal.clientId,
      principalId: principal.id,
      scopes: grantedScopes,
    };

    const token = this.jwtService.sign(payload, { expiresIn });

    // 6. Simpan hash ke DB (untuk keperluan revoke)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date((now + expiresIn) * 1000);

    await this.accessTokenRepo.save({
      principalId: principal.id,
      tokenHash,
      scopes: grantedScopes,
      expiresAt,
    });

    this.logger.info(`Token issued for principal: ${principal.name} | scopes: ${grantedScopes.join(', ')}`);

    return {
      message: SUCCESS_MESSAGE.TOKEN,
      data : {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn,
        scopes: grantedScopes,
      }       
    };
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      // 1. Verify JWT signature & expiry
      const payload = this.jwtService.verify<JwtPayload>(token);

      // 2. Cek apakah token sudah di-revoke di DB
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const storedToken = await this.accessTokenRepo.findOne({
        where: { tokenHash },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new UnauthorizedException('Token has been revoked');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async revokeToken(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.accessTokenRepo.update(
      { tokenHash },
      { revokedAt: new Date() },
    );

    return {
      message: SUCCESS_MESSAGE.REVOKE,
    };
  }

  /** Cleanup expired tokens (dipanggil via scheduler) */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.accessTokenRepo
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();
    return result.affected || 0;
  }
}
