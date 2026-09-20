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

import { SecondarySalesService } from './secondary-sales.service';
import { SecondarySalesQueryDto } from './dto/secondary-sales-query.dto';
import { SecondarySalesSnapshotResponseDto } from './dto/secondary-sales-snapshot.dto';

import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';

@ApiTags('Secondary Sales')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/secondary-sales')
export class SecondarySalesController {
  constructor(
    private readonly secondarySalesService: SecondarySalesService,
  ) {}

  @Get('invoices')
  @ApiOperation({
    summary: 'Secondary Sales Invoices',
    description:
      'Mengambil daftar invoice secondary sales dari data sinkronisasi iDempiere ' +
      'berdasarkan rentang tanggal dan salesman.',
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
    type: SecondarySalesSnapshotResponseDto,
  })
  async getInvoices(
    @Query() query: SecondarySalesQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ): Promise<SecondarySalesSnapshotResponseDto> {
    return this.secondarySalesService.getInvoices(query, principal);
  }
}