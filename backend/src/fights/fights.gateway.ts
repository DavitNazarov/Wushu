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
import { PrismaService } from '../prisma/prisma.service';
import { CAPABILITIES } from '../auth/capabilities';

// BF-7: how often a live socket is re-checked against the DB so a user who is
// suspended/disabled/archived mid-session is dropped within a bounded window
// rather than keeping the live stream until their 15-min JWT expires.
const SOCKET_REVALIDATE_MS = 60_000;

// Event/Mat ids are Prisma cuids (e.g. "cmpuw57s9...") — not UUIDs. Accept cuid
// or uuid shape as input hygiene; the org-scoped DB lookup below is the real gate.
const ID_RE = /^[a-z0-9-]{8,64}$/i;

function assertId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new WsException(`Invalid ${field}`);
  }
  return value;
}

const SOCKET_IO_PATH = '/api/socket.io';

type SocketWithAuth = Socket & {
  data: {
    auth?: import('../auth/auth.service').AuthTokenPayload;
    revalidateTimer?: ReturnType<typeof setInterval>;
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

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use((socket: SocketWithAuth, next) => {
      void (async () => {
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

          // BF-7: a valid signature is NOT enough — re-validate against the DB
          // (reject archived/disabled/DQ-suspended users) and require the
          // LIVE_RUN capability before granting a live scoring socket. Mirrors
          // the HTTP AuthGuard + CapabilityGuard, which the socket bypassed.
          const validated = await this.auth.validateAuthenticatedUser(
            payload.sub,
          );
          if (!validated.ok) {
            return next(new WsException('UNAUTHENTICATED'));
          }
          if (!validated.payload.capabilities.includes(CAPABILITIES.LIVE_RUN)) {
            return next(new WsException('FORBIDDEN'));
          }
          socket.data.auth = validated.payload;
          return next();
        } catch {
          return next(new WsException('UNAUTHENTICATED'));
        }
      })();
    });
  }

  private extractCookieToken(
    rawCookieHeader: string | undefined,
  ): string | null {
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
    // BF-7: keep re-checking the user while the socket is open so a mid-session
    // suspend/disable/role-change drops them within SOCKET_REVALIDATE_MS.
    client.data.revalidateTimer = setInterval(() => {
      void this.revalidateSocket(client);
    }, SOCKET_REVALIDATE_MS);

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
    if (client.data.revalidateTimer) {
      clearInterval(client.data.revalidateTimer);
      client.data.revalidateTimer = undefined;
    }
    this.logger.debug(
      JSON.stringify({
        scope: 'realtime',
        action: 'disconnect',
        clientId: client.id,
        userId: client.data.auth?.sub ?? null,
      }),
    );
  }

  // BF-7: re-validate an open socket against the DB; disconnect if the user is
  // no longer valid or has lost the LIVE_RUN capability.
  private async revalidateSocket(client: SocketWithAuth): Promise<void> {
    const sub = client.data.auth?.sub;
    if (!sub) {
      client.disconnect(true);
      return;
    }
    try {
      const validated = await this.auth.validateAuthenticatedUser(sub);
      if (
        !validated.ok ||
        !validated.payload.capabilities.includes(CAPABILITIES.LIVE_RUN)
      ) {
        this.logger.warn(
          JSON.stringify({
            scope: 'realtime',
            action: 'revalidate-drop',
            clientId: client.id,
            userId: sub,
            reason: validated.ok ? 'LIVE_RUN_REVOKED' : validated.code,
          }),
        );
        client.disconnect(true);
        return;
      }
      client.data.auth = validated.payload;
    } catch {
      // On a transient DB error, leave the socket connected; the next tick
      // re-checks. (Don't drop live operators over a blip.)
    }
  }

  @SubscribeMessage('join-event')
  async handleJoinEvent(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    if (!client.data.auth) {
      throw new WsException('UNAUTHENTICATED');
    }

    const eventId = assertId(
      data && typeof data === 'object'
        ? (data as Record<string, unknown>).eventId
        : undefined,
      'eventId',
    );

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId: client.data.auth.organisationId },
      select: { id: true },
    });
    if (!event) {
      throw new WsException('FORBIDDEN');
    }

    const room = `event:${eventId}`;
    await client.join(room);
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
  async handleJoinMat(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    if (!client.data.auth) {
      throw new WsException('UNAUTHENTICATED');
    }

    const matId = assertId(
      data && typeof data === 'object'
        ? (data as Record<string, unknown>).matId
        : undefined,
      'matId',
    );

    const mat = await this.prisma.mat.findFirst({
      where: { id: matId, organisationId: client.data.auth.organisationId },
      select: { id: true },
    });
    if (!mat) {
      throw new WsException('FORBIDDEN');
    }

    const room = `mat:${matId}`;
    await client.join(room);
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

    return [
      ...new Set(
        candidates.filter(
          (value): value is string => typeof value === 'string',
        ),
      ),
    ];
  }
}
