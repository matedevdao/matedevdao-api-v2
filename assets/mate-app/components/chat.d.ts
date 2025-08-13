import './chat.less';
import { Component } from './component';
interface Options {
    roomId: string;
    myAccount: string;
}
declare function createChatComponent({ roomId, myAccount }: Options): Component & {
    scrollToBottom: () => void;
};
export { createChatComponent };
//# sourceMappingURL=chat.d.ts.map