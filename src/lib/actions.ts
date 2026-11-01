import { SCORED_DIMENSIONS } from './dimensions';
import type { ScoredDimensionId } from './types';

export type ReviewAction = {
  id: string;
  key: string;
  dimension: ScoredDimensionId;
  kind: 'comment_check' | 'source_edit';
  text: string;
  status: 'open' | 'done';
  updatedAt: string;
};
export const ACTION_KINDS = { comment_check: '核查评语', source_edit: '修改原文' } as const;
export const ACTION_STORAGE = 'llm-output-eval:actions:v1';
export function decodeActions(value: unknown): ReviewAction[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) throw Error('处理清单格式不支持，最多500项');
  const ids = new Set<string>();
  return value.map((a: ReviewAction) => {
    if (!a || typeof a.id !== 'string' || a.id.length > 200 || ids.has(a.id) || typeof a.key !== 'string' || a.key.length > 800 || !SCORED_DIMENSIONS.includes(a.dimension) || !Object.hasOwn(ACTION_KINDS, a.kind) || typeof a.text !== 'string' || !a.text.trim() || a.text.length > 500 || !['open', 'done'].includes(a.status) || !Number.isFinite(Date.parse(a.updatedAt))) throw Error('处理清单字段无效');
    ids.add(a.id);
    return { id: a.id, key: a.key, dimension: a.dimension, kind: a.kind, text: a.text, status: a.status, updatedAt: a.updatedAt };
  });
}
