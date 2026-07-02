// 阿里百炼 DashScope 文生图（异步任务：创建 -> 轮询）
// 文档: text-to-image-v2 (wanx2.1-t2i-turbo)

const BASE = 'https://dashscope.aliyuncs.com/api/v1';
const MODEL = 'wanx2.1-t2i-turbo';

export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少环境变量 DASHSCOPE_API_KEY');
  return key;
}

/** 创建生图任务，返回 task_id */
export async function createImageTask(params: {
  prompt: string;
  negativePrompt?: string;
  size?: string;
}): Promise<string> {
  const res = await fetch(
    `${BASE}/services/aigc/text2image/image-synthesis`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: MODEL,
        input: {
          prompt: params.prompt.slice(0, 500),
          negative_prompt: params.negativePrompt?.slice(0, 500),
        },
        parameters: {
          size: params.size || '1024*1024',
          n: 1,
        },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok || !data?.output?.task_id) {
    throw new Error(
      data?.message || data?.code || `创建生图任务失败 (HTTP ${res.status})`
    );
  }
  return data.output.task_id as string;
}

export interface TaskResult {
  status: TaskStatus;
  imageUrl?: string;
  message?: string;
}

/** 查询任务状态，SUCCEEDED 时返回图片 URL */
export async function queryImageTask(taskId: string): Promise<TaskResult> {
  const res = await fetch(`${BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    return { status: 'FAILED', message: data?.message || `HTTP ${res.status}` };
  }

  const status = (data?.output?.task_status || 'UNKNOWN') as TaskStatus;
  if (status === 'SUCCEEDED') {
    const url = data?.output?.results?.[0]?.url;
    return { status, imageUrl: url };
  }
  if (status === 'FAILED') {
    return { status, message: data?.output?.message || '生成失败' };
  }
  return { status };
}
