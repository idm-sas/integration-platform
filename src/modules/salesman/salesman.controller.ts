import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ScopeGuard } from '../../auth/guards/scope.guard';
import { RequireScopes } from '../../common/decorators/require-scopes.decorator';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { JwtPayload } from '../../auth/token.service';
import { SalesmanResponseDto } from './dto/salesman-response.dto';
import { SalesmanService } from './salesman.service';

@ApiTags('Salesman')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ScopeGuard)
@Controller('api/v1/salesman')
export class SalesmanController {
  constructor(private readonly salesmanService: SalesmanService) {}

  @Get()
  @RequireScopes('product:read:*')
  @ApiOperation({
    summary: 'List salesman yang bisa diakses principal',
    description: 'Hanya menampilkan salesman sesuai mapping akses principal.',
  })
  @ApiResponse({ status: 200, type: [SalesmanResponseDto] })
  findAccessible(@CurrentPrincipal() principal: JwtPayload) {
    return this.salesmanService.findAccessible(principal);
  }
}
