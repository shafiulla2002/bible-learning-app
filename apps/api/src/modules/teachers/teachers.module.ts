import { Module } from '@nestjs/common';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TeachersController],
  providers: [TeachersService, PrismaService],
  exports: [TeachersService],
})
export class TeachersModule {}
