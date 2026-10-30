import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, PrismaService],
  exports: [StudentsService],
})
export class StudentsModule {}
