import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TokenService } from './token.service';
import { AuthController } from './auth.controller';
import { BearerStrategy } from './strategies/bearer.strategy';
import { Principal } from '../database/entities/principal.entity';
import { AccessToken } from '../database/entities/access-token.entity';
import { PrincipalCategoryAccess } from '../database/entities/principal-category-access.entity';

@Module({
  imports: [
    LoggerModule.forRoot(),
    PassportModule,
    TypeOrmModule.forFeature([Principal, AccessToken, PrincipalCategoryAccess]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<number>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [TokenService, BearerStrategy],
  exports: [TokenService, JwtModule],
})
export class AuthModule {}
