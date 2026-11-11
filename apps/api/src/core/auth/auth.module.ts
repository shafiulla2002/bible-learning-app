import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InstituteTenantGuard } from './guards/institute-tenant.guard';
import { RolesGuard } from './guards/roles.guard';
import { getRequiredJwtSecret } from './jwt-secret.util';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getRequiredJwtSecret(configService.get<string>('JWT_SECRET')),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtAuthGuard, InstituteTenantGuard, RolesGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, InstituteTenantGuard, RolesGuard],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    getRequiredJwtSecret(this.configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET);
  }
}
