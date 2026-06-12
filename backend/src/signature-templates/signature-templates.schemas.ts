import { z } from 'zod';

// A signature image is stored inline as a base64 data: URL. The cap keeps the
// POST body comfortably under the global 100 KB limit — the admin UI downscales
// the uploaded image before sending.
export const createSignatureTemplateSchema = z.object({
  judgeNameEn: z.string().trim().min(1).max(200),
  judgeNameKa: z.string().trim().max(200).nullish(),
  signature: z
    .string()
    // Full-string anchor incl. the base64 payload charset: the prefix-only
    // version let anything follow the comma (e.g. a `"` that would break out
    // of the <img src="..."> attribute in the PDF template).
    .regex(
      /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
      'INVALID_SIGNATURE',
    )
    .max(90_000, 'SIGNATURE_TOO_LARGE'),
});

export type CreateSignatureTemplateInput = z.infer<
  typeof createSignatureTemplateSchema
>;
