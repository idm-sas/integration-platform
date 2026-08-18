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
import { SecondarySalesResponseDto } from './dto/secondary-sales-snapshot.dto';

import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';

import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';

import { JwtPayload } from '../../auth/token.service';


@ApiTags('Secondary Sales')
@ApiBearerAuth()

@UseGuards(
  AccessTokenGuard,
  ScopeGuard,
)

@Controller('api/v1/secondary-sales')
export class SecondarySalesController {

  constructor(
    private readonly secondarySalesService: SecondarySalesService,
  ) {}


  @Get('invoices')

  // @RequireScopes('secondary-sales:read')

  @ApiOperation({
    summary: 'Secondary Sales Invoice',
    description:
      'Mengambil data transaksi secondary sales realtime dari iDempiere.',
  })

  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })

  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
  })

  @ApiQuery({
    name: 'dateFrom',
    required: false,
    example: '2026-07-01',
  })

  @ApiQuery({
    name: 'dateTo',
    required: false,
    example: '2026-07-31',
  })

  // @ApiQuery({
  //   name: 'salesman',
  //   required: false,
  //   example: 'SM001',
  // })

  // @ApiQuery({
  //   name: 'retailer',
  //   required: false,
  //   example: 'RT001',
  // })

  @ApiResponse({
    status: 200,
    type: SecondarySalesResponseDto,
  })


  async getInvoices(
    @Query() query: SecondarySalesQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ) {

    return this.secondarySalesService.getInvoices(
      query,
      principal,
    );

  }
}