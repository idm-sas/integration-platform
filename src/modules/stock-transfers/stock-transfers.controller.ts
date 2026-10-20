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

import { StockTransfersService } from './stock-transfers.service';
import { StockTransfersQueryDto } from './dto/stock-transfers-query.dto';
import { StockTransfersSnapshotResponseDto } from './dto/stock-transfers-snapshot.dto';

import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';

@ApiTags('Stock Transfers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/inventory')
export class StockTransfersController {
  constructor(
    private readonly stockTransfersService: StockTransfersService,
  ) {}

  @Get('transfers')
  @ApiOperation({
    summary: 'List stock transfers',
    description:
      'Mengambil data stock transfer berdasarkan periode tanggal movement.',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: true,
    type: String,
    example: '2026-02-01',
    description: 'Tanggal awal periode movement (YYYY-MM-DD).',
  })
  @ApiQuery({
    name: 'dateTo',
    required: true,
    type: String,
    example: '2026-02-28',
    description: 'Tanggal akhir periode movement (YYYY-MM-DD).',
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
  @ApiResponse({
    status: 200,
    description: 'Data stock transfer berhasil diambil.',
    type: StockTransfersSnapshotResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Parameter query tidak valid.',
  })
  @ApiResponse({
    status: 401,
    description: 'Access token tidak valid atau sudah kedaluwarsa.',
  })
  @ApiResponse({
    status: 403,
    description: 'Tidak memiliki izin mengakses data stock transfer.',
  })
  async getStockTransfers(
    @Query() query: StockTransfersQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ): Promise<StockTransfersSnapshotResponseDto> {
    return this.stockTransfersService.getStockTransfers(
      query,
      principal,
    );
  }
}