import { Hierarchy, HierarchyType } from '../hierarchy/markdownNodes';

function detectTodoType(content: string) {
  if (content.startsWith('[ ] ')) {
    return 'todo';
  }
  if (content.startsWith('[x] ') || content.startsWith('[X] ')) {
    return 'done';
  }

  return undefined;
}

export function removeTodo(content: string, hierarchy: Hierarchy): [string, 'todo' | 'done'] | null {
  if (hierarchy.type === HierarchyType.BULLET) {
    const type = detectTodoType(content);
    if (type) {
      return [content.slice('[ ] '.length), type];
    }
  }
  return null;
}
