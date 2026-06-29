import { ApiProperty } from '@nestjs/swagger';

export class TokenDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 3600, description: 'Detik sampai token expired' })
  expiresIn: number;

  @ApiProperty({
    example: ['product:read:electronics'],
    isArray: true,
    type: String,
  })
  scopes: string[];
}

export class TokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Token generated successfully' })
  message: string;

  @ApiProperty({ type: TokenDataDto })
  data: TokenDataDto;

  @ApiProperty({ example: '2026-06-28T02:25:05.313Z' })
  timestamp: string;

  @ApiProperty({ example: '4d6aec70-e10f-4f2d-b017-fd8652604cd6' })
  requestId: string;
}
