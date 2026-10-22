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

import { PrimaryInvoicesService } from './primary-invoices.service';
import { PrimaryInvoicesQueryDto } from './dto/primary-invoices-query.dto';
import { PrimaryInvoicesSnapshotResponseDto } from './dto/primary-invoices-snapshot.dto';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';

@ApiTags('Primary Invoices')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/primary')
export class PrimaryInvoicesController {
  constructor(
    private readonly primaryInvoicesService: PrimaryInvoicesService,
  ) {}

  @Get('invoices')
  @ApiOperation({
    summary: 'Primary Invoices',
    description:
      'Mengambil daftar invoice vendor dari data sinkronisasi iDempiere ',
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
    type: PrimaryInvoicesSnapshotResponseDto,
  })
  async getInvoices(
    @Query() query: PrimaryInvoicesQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ): Promise<PrimaryInvoicesSnapshotResponseDto> {
    return this.primaryInvoicesService.getInvoices(query, principal);
  }
}