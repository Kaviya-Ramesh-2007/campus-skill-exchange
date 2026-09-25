import { Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { notificationQuerySchema } from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { NotificationsService } from './notifications.service';

class NotificationQueryDto {
  declare page?: number;
  declare limit?: number;
}
ZodSchema(notificationQuerySchema)(NotificationQueryDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly service: NotificationsService) {}

  @Get()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List the current User notifications, newest first' })
  async list(@CurrentUser() user: { id: string }, @Query() query: NotificationQueryDto) {
    const result = await this.service.list(user.id, query);
    return {
      success: true,
      data: {
        items: result.items,
        pagination: {
          page: result.page,
          pageSize: result.limit,
          total: result.total,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / result.limit),
        },
      },
    };
  }

  @Get('unread-count')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get the current User unread notification count' })
  async unreadCount(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.service.unreadCount(user.id) };
  }

  @Patch('read-all')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Mark every notification read for the current User' })
  async markAllRead(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.service.markAllRead(user.id) };
  }

  @Patch(':id/read')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Mark one notification read for the current User' })
  async markRead(@CurrentUser() user: { id: string }, @Param('id', idPipe) id: string) {
    return { success: true, data: await this.service.markRead(id, user.id) };
  }
}
