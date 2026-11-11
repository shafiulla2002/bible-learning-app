import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PrismaService } from '../../core/prisma/prisma.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PrismaService],
  exports: [PlatformService],
})
export class PlatformModule {}

