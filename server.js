require('dotenv/config');

const path = require('path');
const express = require('express');
const next = require('next');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { createApp } = require('./backend/dist/src/main');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 4000);
const frontendDir = path.join(__dirname, 'frontend');

async function bootstrap() {
  const server = express();
  const apiServer = express();
  const originalCwd = process.cwd();

  process.chdir(frontendDir);
  const nextApp = next({ dev, dir: frontendDir });
  const nextHandler = nextApp.getRequestHandler();
  await nextApp.prepare();
  process.chdir(originalCwd);

  const nestApp = await createApp({
    httpAdapter: new ExpressAdapter(apiServer),
    globalPrefix: false,
  });
  await nestApp.init();
  // REL-2: run Nest shutdown hooks (Prisma $disconnect, timer-interval cleanup)
  // when the process is asked to stop.
  nestApp.enableShutdownHooks();

  server.use('/api', apiServer);
  server.all(/^(?!\/api(?:\/|$)).*/, (req, res) => nextHandler(req, res));

  const httpServer = server.listen(port, () => {
    // Keep startup logging minimal and explicit.
    console.log(`Combined Next/Nest server listening on ${port}`);
  });

  // REL-2: graceful shutdown on deploy/restart/scale-down — stop accepting new
  // connections, then close the Nest app (disconnecting Prisma) before exiting,
  // instead of abruptly dropping in-flight requests mid-event.
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    httpServer.close();
    try {
      await nestApp.close();
    } catch (err) {
      console.error('Error during Nest app shutdown', err);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start combined server', error);
  process.exit(1);
});
