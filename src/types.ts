// Shared JSON shapes stored in the DB and passed across the pipeline.

export interface VisionScore {
  issueType: 'spillage' | 'missing_item' | 'wrong_item' | 'damaged' | 'unclear' | 'none';
  severity: number; // 0..1
  confidence: number; // 0..1
  notes?: string;
}

export interface IntegrityVerdict {
  valid: boolean;
  duplicate: boolean;
  duplicateOfAttachmentId?: string;
  reason?: string;
}

export interface PolicyTrace {
  rules: Array<{ id: string; passed: boolean; score?: number }>;
  decision: string;
  notes?: string;
}

export interface TraceStep {
  stage: string;
  ms: number;
  data?: Record<string, unknown>;
}

export interface MessagePayload {
  kind?: string;
  [key: string]: unknown;
}
