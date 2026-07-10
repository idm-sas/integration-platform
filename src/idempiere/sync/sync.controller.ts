import { Controller, Post, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';

@ApiTags('Sync')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/sync')
export class SyncController {
  constructor(private readonly orchestrator: SyncOrchestratorService) {}

  @Get('status')
  @RequireScopes('product:sync:*')
  @ApiOperation({
    summary: 'Status sync terakhir',
    description: 'Menampilkan info kapan full sync dan incremental sync terakhir berjalan.',
  })
  getStatus() {
    return {
      message: SUCCESS_MESSAGE.FETCH,
      data: this.orchestrator.getStatus(),
    };
  }

  @Post('full')
  @RequireScopes('product:sync:*')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger full sync manual',
    description:
      'Sync ulang semua data (category → salesman → product → price) dari iDempiere ke MiddleDB.\n\n' +
      '⚠️ Berjalan di background. Pantau progress via `GET /api/v1/sync/status`.',
  })
  triggerFullSync() {
    this.orchestrator.runFullSync().catch((err) =>
      console.error('Background full sync error:', err),
    );

    return {
      message: 'Full sync started in background',
      data: {
        startedAt: new Date().toISOString(),
        checkStatusAt: '/api/v1/sync/status',
      },
    };
  }

  @Post('incremental')
  @RequireScopes('product:sync:*')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger incremental sync manual',
    description: 'Sync hanya data yang berubah sejak sync terakhir.',
  })
  triggerIncrementalSync() {
    this.orchestrator.runIncrementalSync().catch((err) =>
      console.error('Background incremental sync error:', err),
    );

    return {
      message: 'Incremental sync started in background',
      data: {
        startedAt: new Date().toISOString(),
        checkStatusAt: '/api/v1/sync/status',
      },
    };
  }
}
