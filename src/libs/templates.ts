import { query } from '~/libs/db';

export interface TemplateRow {
  id: number;
  kind: string; // image | book
  topic: string;
  style_key: string;
  title: string;
  subtitle: string | null;
  brief: string;
  options: Record<string, any> | null;
  prompt: string | null;
  cover_url: string | null;
  sort: number;
}

export async function listTemplates(filter: {
  kind?: string;
  topic?: string;
  style?: string;
}): Promise<TemplateRow[]> {
  const where: string[] = [];
  const args: any[] = [];
  if (filter.kind) {
    args.push(filter.kind);
    where.push(`kind = $${args.length}`);
  }
  if (filter.topic) {
    args.push(filter.topic);
    where.push(`topic = $${args.length}`);
  }
  if (filter.style) {
    args.push(filter.style);
    where.push(`style_key = $${args.length}`);
  }
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  return query<TemplateRow>(
    `select * from templates ${clause} order by sort asc, id asc`,
    args
  );
}
