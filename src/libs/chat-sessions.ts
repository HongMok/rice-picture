// 小禾AI 对话会话入库：一次多轮对话 = 一行，messages 存 jsonb。
import { query, queryOne } from '~/libs/db';
import type { ChatMessage } from '~/libs/chat';

export interface ChatSessionRow {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: number | null;
  title: string | null;
  messages: ChatMessage[];
  child_id: number | null;
}

function titleFromFirstUserMessage(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const raw = (firstUser?.content || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '未命名对话';
  return raw.length > 20 ? raw.slice(0, 20) + '…' : raw;
}

/** 新建会话；只在首轮消息发出后调用。 */
export async function createChatSession(params: {
  userId: number;
  messages: ChatMessage[];
  childId?: number | null;
}): Promise<ChatSessionRow> {
  const title = titleFromFirstUserMessage(params.messages);
  const rows = await query<ChatSessionRow>(
    `insert into chat_sessions (user_id, title, messages, child_id)
     values ($1, $2, $3::jsonb, $4)
     returning id, created_at, updated_at, user_id, title, messages, child_id`,
    [
      params.userId,
      title,
      JSON.stringify(params.messages),
      params.childId ?? null,
    ]
  );
  return rows[0];
}

/** 追加/覆盖会话消息（对话继续时用完整数组覆盖）。 */
export async function updateChatSessionMessages(params: {
  id: number;
  userId: number;
  messages: ChatMessage[];
}): Promise<void> {
  await query(
    `update chat_sessions
        set messages = $1::jsonb,
            updated_at = now()
      where id = $2 and user_id = $3 and deleted_at is null`,
    [JSON.stringify(params.messages), params.id, params.userId]
  );
}

export async function getChatSession(params: {
  id: number;
  userId: number;
}): Promise<ChatSessionRow | null> {
  const row = await queryOne<ChatSessionRow>(
    `select id, created_at, updated_at, user_id, title, messages, child_id
       from chat_sessions
      where id = $1 and user_id = $2 and deleted_at is null`,
    [params.id, params.userId]
  );
  return row;
}

/** 重命名会话（用户手动改标题）。 */
export async function renameChatSession(params: {
  id: number;
  userId: number;
  title: string;
}): Promise<void> {
  await query(
    `update chat_sessions set title = $1, updated_at = now()
      where id = $2 and user_id = $3 and deleted_at is null`,
    [params.title, params.id, params.userId]
  );
}

/** 软删（Library 统一走 deleted_at）。 */
export async function softDeleteChatSession(params: {
  id: number;
  userId: number;
}): Promise<void> {
  await query(
    `update chat_sessions set deleted_at = now()
      where id = $1 and user_id = $2 and deleted_at is null`,
    [params.id, params.userId]
  );
}
