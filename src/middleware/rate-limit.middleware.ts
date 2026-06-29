import {
  Injectable, NestMiddleware, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Principal } from '../database/entities/principal.entity';
import { JwtPayload } from '../auth/token.service';
import * as crypto from 'crypto';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * Rate Limiter per-principal menggunakan in-memory Map.
 * Untuk production, ganti dengan Redis untuk support multi-instance.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    @InjectRepository(Principal)
    private principalRepo: Repository<Principal>,
  ) {}

  async use(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) {
    const user = req.user;
    if (!user) {
      return next(); // Auth belum pass, biarkan guard yang handle
    }

    const principal = await this.principalRepo.findOne({
      where: { id: user.principalId },
    });

    if (!principal || principal.rateLimitRpm === 0) {
      return next(); // unlimited
    }

    const key = `rl:${principal.id}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 menit

    let bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count++;

    // Set headers informatif
    res.setHeader('X-RateLimit-Limit', principal.rateLimitRpm);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, principal.rateLimitRpm - bucket.count));
    res.setHeader('X-RateLimit-Reset', new Date(bucket.resetAt).toISOString());

    if (bucket.count > principal.rateLimitRpm) {
      this.logger.warn(`Rate limit exceeded for principal: ${principal.name}`);
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded. Max ${principal.rateLimitRpm} requests/minute.`,
            retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
