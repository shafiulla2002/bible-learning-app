import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { PrismaService } from '../../core/prisma/prisma.service';

@Module({
  controllers: [BatchesController],
  providers: [BatchesService, PrismaService],
  exports: [BatchesService],
})
export class BatchesModule {}
