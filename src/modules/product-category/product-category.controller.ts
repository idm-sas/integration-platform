import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductCategoryService } from './product-category.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';

@ApiTags('Product Categories')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/product-categories')
export class ProductCategoryController {
  constructor(private readonly categoryService: ProductCategoryService) {}

  @Get()
  @RequireScopes('product:read:*')
  @ApiOperation({
    summary: 'List category yang bisa diakses principal',
    description: 'Hanya menampilkan category sesuai mapping akses principal.',
  })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  findAccessible(@CurrentPrincipal() principal: JwtPayload) {
    return this.categoryService.findAccessible(principal);
  }
}
