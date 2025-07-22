type Attachment = {
  kind: 'image';          // 확장 시 'file', 'audio' 등 추가 가능
  url: string;
  thumb?: string;  // imgbb thumb.url
};

type ChatMessage = {
  id: number;
  localId?: string; 
  type: 'chat';           // 지금은 chat 고정
  account: string;
  text: string;           // 본문
  attachments: Attachment[];
  timestamp: number;
};

export type { Attachment, ChatMessage };
