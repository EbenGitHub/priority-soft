import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('users/:userId')
  listForUser(@Param('userId') userId: string) {
    return this.notificationsService.listForUser(userId);
  }

  @Get('users/:userId/preferences')
  getPreferences(@Param('userId') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Put('users/:userId/preferences')
  updatePreferences(@Param('userId') userId: string, @Body() body: any) {
    return this.notificationsService.updatePreferences(userId, body);
  }

  @Put('users/:userId/:notificationId/read')
  markRead(@Param('userId') userId: string, @Param('notificationId') notificationId: string) {
    return this.notificationsService.markRead(userId, notificationId);
  }

  @Put('users/:userId/read-all')
  markAllRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}
