// Provider-neutral boundary. SDK objects and tokens never enter the chat/store domain.
export interface MediaService {
  access(
    sessionId: string,
    participantId: string,
    publish: boolean,
    expiresAt: number,
    browserId?: string,
  ): Promise<{ url: string; token: string }>;
  end(sessionId: string): Promise<void>;
  webhook(body: string, authorization: string): Promise<{ ok: boolean }>;
  close?(): void;
}
