import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiAssistanceController } from './ai-assistance.controller';
import { AiAssistanceService } from './ai-assistance.service';
import { AI_PROVIDER, OpenAiCompatibleProvider } from './ai.provider';

@Module({
  imports: [AuthModule],
  controllers: [AiAssistanceController],
  providers: [{ provide: AI_PROVIDER, useClass: OpenAiCompatibleProvider }, AiAssistanceService],
  exports: [AiAssistanceService],
})
export class AiAssistanceModule {}
