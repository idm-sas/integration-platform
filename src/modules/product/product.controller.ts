import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { PaginatedProductResponseDto, ProductResponseDto } from './dto/product-response.dto';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequireScopes('product:read:*')
  @ApiOperation({
    summary: 'Product List',
    description: 'Data produk difilter otomatis sesuai akses category principal.',
  })
  @ApiResponse({ status: 200, type: PaginatedProductResponseDto })
  findAll(
    @Query() query: ProductQueryDto,
    @CurrentPrincipal() principal: JwtPayload,
  ) {
    return this.productService.findAll(query, principal);
  }

  // @Get(':id')
  // @RequireScopes('product:read:*')
  // @ApiOperation({ summary: 'Detail produk by ID' })
  // @ApiParam({ name: 'id', description: 'UUID produk' })
  // @ApiResponse({ status: 200, type: ProductResponseDto })
  // @ApiResponse({ status: 404, description: 'Product not found' })
  // @ApiResponse({ status: 403, description: 'Category not permitted' })
  // findOne(
  //   @Param('id') id: string,
  //   @CurrentPrincipal() principal: JwtPayload,
  // ) {
  //   return this.productService.findOne(id, principal);
  // }

  // @Get('code/:code')
  // @RequireScopes('product:read:*')
  // @ApiOperation({ summary: 'Detail produk by kode produk' })
  // @ApiParam({ name: 'code', description: 'Kode produk (case-insensitive)' })
  // @ApiResponse({ status: 200, type: ProductResponseDto })
  // findByCode(
  //   @Param('code') code: string,
  //   @CurrentPrincipal() principal: JwtPayload,
  // ) {
  //   return this.productService.findByCode(code, principal);
  // }
}
