export type DragFight = { fightId: string; fromSessionId: string };
export type DropFightTarget = { sessionId: string; insertAfterOrder: number };

export type SessionFormState = { name: string; nameKa: string; startTime: string; endTime: string };

export const EMPTY_SESSION_FORM: SessionFormState = { name: '', nameKa: '', startTime: '', endTime: '' };

export type GenerateFormState = { avgBoutSeconds: number; bufferSeconds: number };

export const DEFAULT_GENERATE_FORM: GenerateFormState = { avgBoutSeconds: 180, bufferSeconds: 60 };
