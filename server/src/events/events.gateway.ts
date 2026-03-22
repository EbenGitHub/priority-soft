import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`[WebSockets] Active Pipeline Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WebSockets] Active Pipeline Disconnected: ${client.id}`);
  }

  @SubscribeMessage('notifications:join')
  handleNotificationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { userId?: string },
  ) {
    if (!body?.userId) return;
    client.join(`user:${body.userId}`);
  }

  emitScheduleUpdate() {
    console.log(`[WebSockets] Emitting Real-time DB Synchronization Payload...`);
    this.server.emit('schedule_mutation');
  }

  emitNotificationCreated(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification_created', notification);
  }

  emitNotificationRead(userId: string, notificationId: string, readAt: Date | null) {
    this.server.to(`user:${userId}`).emit('notification_read', {
      notificationId,
      readAt,
    });
  }

  emitNotificationsAllRead(userId: string) {
    this.server.to(`user:${userId}`).emit('notifications_all_read', { userId });
  }

  emitNotificationPreferencesUpdated(
    userId: string,
    preferences: { inAppEnabled: boolean; emailEnabled: boolean },
  ) {
    this.server.to(`user:${userId}`).emit('notification_preferences_updated', preferences);
  }
}
