import { Hierarchy, HierarchyType } from './markdownNodes';

function detectTodoType(content: string) {
  if (content.startsWith('[ ] ')) {
    return 'todo';
  }
  if (content.startsWith('[x] ') || content.startsWith('[X] ')) {
    return 'done';
  }

  return undefined;
}

export function removeTodo(content: string, hierachy: Hierarchy): [string, 'todo' | 'done'] | null {
  if (hierachy.type === HierarchyType.BULLET) {
    const type = detectTodoType(content);
    if (type) {
      return [content.slice('[ ] '.length), type];
    }
  }
  return null;
}
