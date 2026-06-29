import { createHash } from 'node:crypto';
import type { ImageInput, LlmProvider } from '../llm';
import * as repo from '../repositories';
import type { VisionScore } from '../types';
import { scoreImage } from './vision';

export interface ImageAssessment {
  attachmentId: string;
  duplicate: boolean;
  score: VisionScore;
}


export async function assessImage(
  llm: LlmProvider,
  conversationId: string,
  image: ImageInput,
  claim: string,
  signal?: AbortSignal,
): Promise<ImageAssessment> {
  const sha256 = createHash('sha256').update(Buffer.from(image.dataBase64, 'base64')).digest('hex');
  const priors = await repo.findAttachmentsBySha(sha256);
  const duplicateOf = priors.find((a) => a.conversationId !== conversationId);
  const duplicate = duplicateOf !== undefined;

  const score = await scoreImage(llm, image, claim, signal);

  const attachment = await repo.addAttachment({
    conversationId,
    url: `data:${image.mimeType};base64,${image.dataBase64}`,
    sha256,
    integrityVerdict: { valid: true, duplicate, ...(duplicateOf ? { duplicateOfAttachmentId: duplicateOf.id } : {}) },
    visionScore: score,
  });

  return { attachmentId: attachment.id, duplicate, score };
}
