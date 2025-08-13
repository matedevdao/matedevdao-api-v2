type Attachment = {
    kind: 'image';
    url: string;
    thumb?: string;
};
type ChatMessage = {
    id: number;
    localId?: string;
    type: 'chat';
    account: string;
    text: string;
    attachments: Attachment[];
    timestamp: number;
};
export type { Attachment, ChatMessage };
//# sourceMappingURL=chat.d.ts.map