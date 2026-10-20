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
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustmentsQueryDto } from './dto/stock-adjustments-query.dto';
import { StockAdjustmentsSnapshotResponseDto } from './dto/stock-adjustments-snapshot.dto';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';

@ApiTags('Stock Adjustments')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/inventory')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Get('adjustments')
  @ApiOperation({
    summary: 'List stock adjustments',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: true,
    type: String,
    example: '2026-02-01',
    description: 'Tanggal awal periode invoice (YYYY-MM-DD).',
  })
  @ApiQuery({
    name: 'dateTo',
    required: true,
    type: String,
    example: '2026-02-28',
    description: 'Tanggal akhir periode invoice (YYYY-MM-DD).',
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
    type: StockAdjustmentsSnapshotResponseDto,
  })
  async getInvoices(
    @Query() query: StockAdjustmentsQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ): Promise<StockAdjustmentsSnapshotResponseDto> {
    return this.stockAdjustmentsService.getStockAdjustments(query, principal);
  }
}