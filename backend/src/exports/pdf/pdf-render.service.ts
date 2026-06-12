import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import puppeteer from 'puppeteer';

// Derive the Browser type from the launch() return so we don't depend on
// puppeteer re-exporting it by name (its types entry only re-exports a subset).
type Browser = Awaited<ReturnType<typeof puppeteer.launch>>;

export type PdfRenderOptions = {
  landscape?: boolean;
  format?: 'A4' | 'A3' | 'Letter';
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
};

// Renders are serialised (see renderChain), so the queue depth is the number
// of callers waiting on the chain. Beyond this we shed load with EXPORT_BUSY
// instead of letting a burst of export clicks stack minutes of Chromium work
// on the single-instance server.
const MAX_PENDING_RENDERS = 3;

// Hard wall-clock cap per render. setContent has its own 30s timeout, but
// page.pdf() can also wedge — when this fires we kill the whole browser so
// the next render starts from a fresh Chromium instead of a stuck one.
const RENDER_WATCHDOG_MS = 45_000;

// Wraps a single, reused headless Chromium for HTML -> PDF rendering.
//
// Why a singleton browser: launching Chromium is expensive (~hundreds of ms +
// memory), and the prod target is a single footprint-sensitive VPS. We keep one
// browser alive, open a fresh page per render, and serialise renders so we never
// hold more than one tab open at a time (caps peak memory).
//
// Chromium binary:
//   - dev: puppeteer's bundled download (installed with the package).
//   - prod (Docker): system chromium via PUPPETEER_EXECUTABLE_PATH.
@Injectable()
export class PdfRenderService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  // Serialises renders into a single chain so concurrent export requests don't
  // each open a tab at once (memory spike on the single-instance server).
  private renderChain: Promise<unknown> = Promise.resolve();
  private pendingRenders = 0;

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  // Render a full HTML document to a PDF buffer. Assets must be inlined
  // (data: URIs, system fonts) — we wait for `load`, not network fetches.
  // Load-shedding: at most MAX_PENDING_RENDERS callers may wait on the chain;
  // extras get EXPORT_BUSY (503) immediately rather than queueing unbounded.
  async renderPdf(
    html: string,
    options: PdfRenderOptions = {},
  ): Promise<Buffer> {
    if (this.pendingRenders >= MAX_PENDING_RENDERS) {
      throw new ServiceUnavailableException('EXPORT_BUSY');
    }
    this.pendingRenders++;
    const run = this.renderChain
      .then(() => this.renderWithWatchdog(html, options))
      .finally(() => {
        this.pendingRenders--;
      });
    // Keep the chain alive even if this render rejects.
    this.renderChain = run.catch(() => undefined);
    return run;
  }

  // Race the render against a hard timeout. On timeout the shared browser is
  // force-closed (and nulled) so the next render relaunches Chromium — a tab
  // that ignores its own timeouts usually means the whole browser is wedged.
  private async renderWithWatchdog(
    html: string,
    options: PdfRenderOptions,
  ): Promise<Buffer> {
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      watchdog = setTimeout(() => {
        reject(new ServiceUnavailableException('PDF_RENDER_TIMEOUT'));
      }, RENDER_WATCHDOG_MS);
    });

    try {
      const renderPromise = this.renderOnce(html, options);
      // If the watchdog wins the race, the orphaned render promise still
      // rejects later (browser closed under it) — register a handler so that
      // rejection doesn't surface as an unhandled-rejection crash.
      renderPromise.catch(() => undefined);
      return await Promise.race([renderPromise, timeoutPromise]);
    } catch (err) {
      if (
        err instanceof ServiceUnavailableException &&
        (err.message === 'PDF_RENDER_TIMEOUT' ||
          (err.getResponse() as { message?: string })?.message ===
            'PDF_RENDER_TIMEOUT')
      ) {
        this.logger.error(
          `PDF render exceeded ${RENDER_WATCHDOG_MS}ms — recycling Chromium`,
        );
        const browser = this.browser;
        this.browser = null;
        if (browser) {
          await browser.close().catch(() => undefined);
        }
      }
      throw err;
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }
  }

  private async renderOnce(
    html: string,
    options: PdfRenderOptions,
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Assets are inlined (data: URIs + system fonts), so 'load' is enough —
      // there are no network requests to idle on. ('networkidle0' isn't a valid
      // setContent option in this puppeteer version anyway.)
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      const pdf = await page.pdf({
        format: options.format ?? 'A4',
        landscape: options.landscape ?? false,
        printBackground: true,
        preferCSSPageSize: true,
        margin: options.margin ?? {
          top: '8mm',
          right: '8mm',
          bottom: '8mm',
          left: '8mm',
        },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = this.launch()
      .then((browser) => {
        this.browser = browser;
        browser.on('disconnected', () => {
          // Drop the handle so the next render relaunches.
          if (this.browser === browser) this.browser = null;
        });
        return browser;
      })
      .finally(() => {
        this.launching = null;
      });

    return this.launching;
  }

  private async launch(): Promise<Browser> {
    try {
      return await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          // Required when running as the unprivileged node user inside Docker.
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // Containers ship a tiny /dev/shm; use /tmp instead to avoid crashes.
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
      });
    } catch (err) {
      this.logger.error(
        `Failed to launch Chromium for PDF export: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new ServiceUnavailableException('PDF_ENGINE_UNAVAILABLE');
    }
  }
}
