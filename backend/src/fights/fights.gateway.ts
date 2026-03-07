import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class FightsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join-event')
  handleJoinEvent(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `event:${data.eventId}`;
    void client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('join-mat')
  handleJoinMat(
    @MessageBody() data: { matId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `mat:${data.matId}`;
    void client.join(room);
    return { ok: true, room };
  }

  emitFightUpdate(eventId: string, matId: string | null, payload: unknown) {
    this.server.to(`event:${eventId}`).emit('fight:update', payload);
    if (matId) {
      this.server.to(`mat:${matId}`).emit('fight:update', payload);
    }
  }

  emitTimerUpdate(eventId: string, matId: string | null, payload: unknown) {
    this.server.to(`event:${eventId}`).emit('timer:update', payload);
    if (matId) {
      this.server.to(`mat:${matId}`).emit('timer:update', payload);
    }
  }

  emitScheduleUpdate(eventId: string, payload: unknown) {
    this.server.to(`event:${eventId}`).emit('schedule:update', payload);
  }
}
