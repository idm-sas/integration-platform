import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiAuditLog } from '../database/entities/api-audit-log.entity';
import { JwtPayload } from '../auth/token.service';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLogMiddleware.name);

  constructor(
    @InjectRepository(ApiAuditLog)
    private auditLogRepo: Repository<ApiAuditLog>,
  ) {}

  use(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', async () => {
      try {
        const durationMs = Date.now() - startTime;
        const user = req.user;

        // Skip health check endpoints dari audit log
        if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
          return;
        }

        await this.auditLogRepo.save({
          principalId: user?.principalId || null,
          method: req.method,
          endpoint: req.path,
          queryParams: Object.keys(req.query).length > 0
            ? JSON.stringify(req.query)
            : null,
          statusCode: res.statusCode,
          durationMs,
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent'],
        });
      } catch (err) {
        this.logger.error('Failed to write audit log', err);
      }
    });

    next();
  }
}
