import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { aiAssistSchema, aiChatSchema, type AuthUser } from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { AiAssistanceService } from './ai-assistance.service';

class AiAssistDto {
  declare action:
    'explain_match' | 'session_topics' | 'session_agenda' | 'draft_message' | 'summarize';
  declare context: string;
  declare additionalNotes?: string;
}
ZodSchema(aiAssistSchema)(AiAssistDto);

class AiChatDto {
  declare message: string;
}
ZodSchema(aiChatSchema)(AiChatDto);

@ApiTags('ai')
@Controller({ path: 'ai', version: '1' })
export class AiAssistanceController {
  constructor(@Inject(AiAssistanceService) private readonly service: AiAssistanceService) {}

  @Post('assist')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Generate a short AI assist over User-supplied context' })
  async assist(@CurrentUser() user: AuthUser, @Body() body: AiAssistDto) {
    return { success: true, data: await this.service.assist(user, body) };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Ask the Campus Skill Exchange assistant a question' })
  async chat(@CurrentUser() user: AuthUser, @Body() body: AiChatDto) {
    // Only the new message crosses the wire; the conversation stays in the client.
    return { success: true, data: await this.service.chat(user, body) };
  }
}
