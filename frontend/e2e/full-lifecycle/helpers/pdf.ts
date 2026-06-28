import { expect, type APIResponse, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Assert a buffer is a real PDF (the `%PDF-` magic header).
export function expectPdf(buf: Buffer, label: string): void {
  expect(buf.subarray(0, 5).toString('latin1'), `${label} is a PDF`).toBe('%PDF-');
}

// Capture a browser-initiated download (the results export drawer creates an
// anchor + clicks it via downloadBlob) and assert the file is a valid PDF.
export async function captureDownloadPdf(
  page: Page,
  trigger: () => Promise<void>,
  label = 'export',
): Promise<Download> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    trigger(),
  ]);
  const path = await download.path();
  expect(path, `${label} download produced a file`).toBeTruthy();
  const buf = await readFile(path!);
  expectPdf(buf, label);
  return download;
}

// Assert an API PDF response (used for the schedule/weigh-in PDFs we fetch
// directly rather than through the drawer).
export async function expectPdfResponse(res: APIResponse, label: string): Promise<void> {
  expect(res.ok(), `${label}: ${res.status()}`).toBeTruthy();
  expectPdf(await res.body(), label);
}
