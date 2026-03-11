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

  server.use('/api', apiServer);
  server.all(/^(?!\/api(?:\/|$)).*/, (req, res) => nextHandler(req, res));

  server.listen(port, () => {
    // Keep startup logging minimal and explicit.
    console.log(`Combined Next/Nest server listening on ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start combined server', error);
  process.exit(1);
});
