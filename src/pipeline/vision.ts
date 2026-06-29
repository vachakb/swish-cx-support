import * as z from 'zod';
import type { ImageInput, LlmProvider } from '../llm';
import type { VisionScore } from '../types';

const VisionSchema: z.ZodType<VisionScore> = z.object({
  issueType: z.enum(['spillage', 'missing_item', 'wrong_item', 'damaged', 'unclear', 'none']),
  severity: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});

const VISION_SYSTEM =
  'You assess photos of food-delivery orders for Swish support. Identify the issue type, how severe it looks (0-1), and your confidence (0-1). Be fair to the customer but watch for signs of tampering or an unrelated image.';

export async function scoreImage(llm: LlmProvider, image: ImageInput, claim: string, signal?: AbortSignal): Promise<VisionScore> {
  try {
    return await llm.generateJson({
      task: 'vision',
      tier: 'vision',
      system: VISION_SYSTEM,
      prompt: `Customer reports: "${claim}". Assess the attached photo of their order.`,
      images: [image],
      schema: VisionSchema,
      signal,
    });
  } catch {
    // Unprocessable image or model error — degrade gracefully (uncorroborated) instead of breaking the turn.
    return { issueType: 'unclear', severity: 0, confidence: 0 };
  }
}
