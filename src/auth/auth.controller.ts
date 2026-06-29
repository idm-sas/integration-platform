import { Controller, Post, Body, HttpCode, HttpStatus, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TokenService } from './token.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private tokenService: TokenService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request access token (OAuth2 Client Credentials)',
    description: 'Token berlaku sesuai expiresIn (detik). Jika expired, request token baru.',
  })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or no valid scopes' })
  async getToken(@Body() dto: TokenRequestDto) {
    return this.tokenService.generateToken(dto);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke access token' })
  @ApiResponse({ status: 200, description: 'Token berhasil di-revoke' })
  async revokeToken(@Headers('authorization') authHeader: string) {
    // Validasi header dulu
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header missing or invalid');
    }

    const token = authHeader.substring(7);
    return this.tokenService.revokeToken(token);
  }
}
