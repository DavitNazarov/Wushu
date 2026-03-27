import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class FightsGateway {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(FightsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'connect',
        clientId: client.id,
      }),
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'disconnect',
        clientId: client.id,
      }),
    );
  }

  @SubscribeMessage('join-event')
  handleJoinEvent(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `event:${data.eventId}`;
    void client.join(room);
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'join-event',
        clientId: client.id,
        eventId: data.eventId,
        room,
      }),
    );
    return { ok: true, room };
  }

  @SubscribeMessage('join-mat')
  handleJoinMat(
    @MessageBody() data: { matId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `mat:${data.matId}`;
    void client.join(room);
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'join-mat',
        clientId: client.id,
        matId: data.matId,
        room,
      }),
    );
    return { ok: true, room };
  }

  emitFightUpdate(eventId: string, matId: string | null, payload: unknown) {
    this.server.to(`event:${eventId}`).emit('fight:update', payload);
    if (matId) {
      this.server.to(`mat:${matId}`).emit('fight:update', payload);
    }
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'emit-fight-update',
        eventId,
        matId,
      }),
    );
  }

  emitTimerUpdate(eventId: string, matId: string | null, payload: unknown) {
    this.server.to(`event:${eventId}`).emit('timer:update', payload);
    if (matId) {
      this.server.to(`mat:${matId}`).emit('timer:update', payload);
    }
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'emit-timer-update',
        eventId,
        matId,
      }),
    );
  }

  emitScheduleUpdate(eventId: string, payload: unknown) {
    this.server.to(`event:${eventId}`).emit('schedule:update', payload);
    for (const matId of this.extractMatIds(payload)) {
      this.server.to(`mat:${matId}`).emit('schedule:update', payload);
    }
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'emit-schedule-update',
        eventId,
        matIds: this.extractMatIds(payload),
      }),
    );
  }

  private extractMatIds(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object') return [];

    const record = payload as Record<string, unknown>;
    const candidates = [
      record.matId,
      record.toMatId,
      record.fromMatId,
      ...(Array.isArray(record.matIds) ? record.matIds : []),
    ];

    return [...new Set(candidates.filter((value): value is string => typeof value === 'string'))];
  }
}
