import { query, queryOne } from '~/libs/db';

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

export interface TemplatePageRow {
  id: number;
  template_id: number;
  page_index: number;
  text: string | null;
  image_url: string | null;
}

export async function getTemplate(id: number): Promise<TemplateRow | null> {
  return queryOne<TemplateRow>('select * from templates where id = $1', [id]);
}

export async function getTemplatePages(
  templateId: number
): Promise<TemplatePageRow[]> {
  return query<TemplatePageRow>(
    'select * from template_pages where template_id = $1 order by page_index asc',
    [templateId]
  );
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
