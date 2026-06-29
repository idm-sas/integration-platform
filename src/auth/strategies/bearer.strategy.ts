import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { TokenService, JwtPayload } from '../token.service';

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy) {
  constructor(private tokenService: TokenService) {
    super();
  }

  async validate(token: string): Promise<JwtPayload> {
    const payload = await this.tokenService.validateToken(token);
    if (!payload) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
