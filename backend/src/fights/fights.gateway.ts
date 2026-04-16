import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { createCorsOriginDelegate } from '../config/runtime-env';
import { AuthService, JWT_COOKIE_NAME } from '../auth/auth.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new WsException(`Invalid ${field}: must be a UUID`);
  }
  return value;
}

const SOCKET_IO_PATH = '/api/socket.io';

type SocketWithAuth = Socket & {
  data: {
    auth?: import('../auth/auth.service').AuthTokenPayload;
  };
};

@WebSocketGateway({
  path: SOCKET_IO_PATH,
  cors: {
    origin: createCorsOriginDelegate(),
    credentials: true,
  },
})
export class FightsGateway implements OnGatewayInit<Server> {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(FightsGateway.name);

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Server) {
    server.use((socket: SocketWithAuth, next) => {
      try {
        const token =
          this.extractCookieToken(socket.request.headers.cookie) ??
          this.extractBearerToken(socket.handshake.auth?.token);
        if (!token) {
          return next(new WsException('UNAUTHENTICATED'));
        }
        const payload = this.auth.verifyToken(token);
        if (!payload) {
          return next(new WsException('UNAUTHENTICATED'));
        }
        socket.data.auth = payload;
        return next();
      } catch {
        return next(new WsException('UNAUTHENTICATED'));
      }
    });
  }

  private extractCookieToken(rawCookieHeader: string | undefined): string | null {
    if (!rawCookieHeader) return null;
    const parts = rawCookieHeader.split(';');
    for (const part of parts) {
      const [rawName, ...rest] = part.split('=');
      const name = rawName?.trim();
      if (name === JWT_COOKIE_NAME) {
        return rest.join('=').trim() || null;
      }
    }
    return null;
  }

  private extractBearerToken(rawAuth: unknown): string | null {
    if (typeof rawAuth !== 'string') return null;
    if (!rawAuth.startsWith('Bearer ')) return null;
    return rawAuth.slice('Bearer '.length).trim() || null;
  }

  handleConnection(client: SocketWithAuth) {
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'connect',
        clientId: client.id,
        userId: client.data.auth?.sub ?? null,
      }),
    );
  }

  handleDisconnect(client: SocketWithAuth) {
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'disconnect',
        clientId: client.id,
        userId: client.data.auth?.sub ?? null,
      }),
    );
  }

  @SubscribeMessage('join-event')
  handleJoinEvent(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    if (!client.data.auth) {
      throw new WsException('UNAUTHENTICATED');
    }

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
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    if (!client.data.auth) {
      throw new WsException('UNAUTHENTICATED');
    }

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
