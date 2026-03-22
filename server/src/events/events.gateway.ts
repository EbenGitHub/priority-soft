import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
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

  emitScheduleUpdate() {
    console.log(`[WebSockets] Emitting Real-time DB Synchronization Payload...`);
    this.server.emit('schedule_mutation');
  }
}
