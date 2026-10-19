interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Keep complete recent messages within the API's count and character limits. */
export function prepareChatHistory(messages: ChatHistoryMessage[]): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = [];
  let length = 0;
  for (let index = messages.length - 1; index >= 0 && history.length < 40; index--) {
    const message = messages[index];
    if (message.content.length > 8000 || length + message.content.length > 32000) break;
    history.unshift({ role: message.role, content: message.content });
    length += message.content.length;
  }
  while (history[0]?.role === 'assistant') history.shift();
  return history;
}
