export type Session = {
  slug: string;
  id: string;
  title: string;
  expiresAt: number;
  protected: boolean;
  usedBytes: number;
};
export type Participant = { id: string; nickname: string; admin: boolean };
export type Publication = {
  id: string;
  participantId: string;
  nickname: string;
  admin: boolean;
  kind: "text" | "file";
  text: string | null;
  filename: string | null;
  size: number;
  createdAt: number;
  editedAt: number | null;
};
export type Snapshot = {
  session: Session;
  me: Participant;
  publications: Publication[];
  participants: Participant[];
};
export const FILE_LIMIT = 50_000_000;
export const SESSION_LIMIT = 1_000_000_000;
