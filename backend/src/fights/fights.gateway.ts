import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { createCorsOriginDelegate } from '../config/runtime-env';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new WsException(`Invalid ${field}: must be a UUID`);
  }
  return value;
}

const SOCKET_IO_PATH = '/api/socket.io';

@WebSocketGateway({
  path: SOCKET_IO_PATH,
  cors: {
    origin: createCorsOriginDelegate(),
    credentials: true,
  },
})
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
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    const eventId = assertUuid(
      data && typeof data === 'object' ? (data as Record<string, unknown>).eventId : undefined,
      'eventId',
    );
    const room = `event:${eventId}`;
    void client.join(room);
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'join-event',
        clientId: client.id,
        eventId,
        room,
      }),
    );
    return { ok: true, room };
  }

  @SubscribeMessage('join-mat')
  handleJoinMat(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    const matId = assertUuid(
      data && typeof data === 'object' ? (data as Record<string, unknown>).matId : undefined,
      'matId',
    );
    const room = `mat:${matId}`;
    void client.join(room);
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'join-mat',
        clientId: client.id,
        matId,
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
