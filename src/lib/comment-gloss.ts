// Optional, record-supplied reading aid. Never translates or changes the original comment.
export function commentGloss(comment: {comment: string}): string {
 const annotated=comment as {comment: string; commentZh?: unknown; comment_zh?: unknown};
 const gloss=[annotated.commentZh,annotated.comment_zh].find((v): v is string=>typeof v==='string'&&!!v.trim()&&v.trim()!==comment.comment.trim());
 return gloss?.trim()??'';
}
