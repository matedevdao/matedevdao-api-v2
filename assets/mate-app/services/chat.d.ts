import { Attachment, ChatMessage } from '../types/chat';
declare class ChatService extends EventTarget {
    #private;
    private roomId;
    private abortController;
    private currentPromise;
    private reconnectDelay;
    private stopped;
    constructor(roomId: string);
    /** SSE 연결 시작 */
    connect(): void;
    /** 연결 중단(페이지 언마운트 시 호출) */
    disconnect(): void;
    /** 텍스트 메시지 전송 → 서버가 확정한 ChatMessage 반환 */
    send(text: string, attachments: Attachment[] | undefined, localId: string): Promise<ChatMessage>;
}
export { ChatMessage, ChatService };
//# sourceMappingURL=chat.d.ts.map