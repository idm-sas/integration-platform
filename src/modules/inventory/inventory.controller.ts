import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { InventoryService } from './inventory.service';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { InventorySnapshotResponseDto } from './dto/inventory-snapshot.dto';

import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';

import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';

import { JwtPayload } from '../../auth/token.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/inventory')
export class InventoryController {

  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @Get('snapshot')
  // @RequireScopes('inventory:read')
  @ApiOperation({
    summary: 'Inventory Snapshot',
    description:
      'Mengambil inventory snapshot realtime dari iDempiere berdasarkan range tanggal.',
  })

  @ApiQuery({
    name: 'dateFrom',
    required: true,
    type: String,
    example: '2026-08-01',
    description: 'Tanggal awal periode inventory.',
  })

  @ApiQuery({
    name: 'dateTo',
    required: true,
    type: String,
    example: '2026-08-18',
    description: 'Tanggal akhir periode inventory.',
  })

  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })

  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })

  // @ApiQuery({
  //   name: 'warehouse',
  //   required: false,
  //   example: 'WH-MAIN-01',
  // })

  // @ApiQuery({
  //   name: 'product',
  //   required: false,
  //   example: 'AB0101000',
  // })

  @ApiResponse({
    status: 200,
    type: InventorySnapshotResponseDto,
  })

  async getSnapshot(
    @Query() query: InventoryQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ) {
    return this.inventoryService.getSnapshot(
      query,
      principal,
    );
  }
}