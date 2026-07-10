import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';
import { RetailerResponseDto } from './dto/retailer-response.dto';
import { RetailerService } from './retailer.service';

@ApiTags('Retailer')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/retailer')
export class RetailerController {
  constructor(private readonly retailerService: RetailerService) {}

  @Get()
  @RequireScopes('product:read:*')
  @ApiOperation({
    summary: 'List retailer yang bisa diakses principal',
    description: 'Hanya menampilkan retailer sesuai mapping akses principal.',
  })
  @ApiResponse({ status: 200, type: [RetailerResponseDto] })
  findAccessible(@CurrentPrincipal() principal: JwtPayload) {
    return this.retailerService.findAccessible(principal);
  }
}
