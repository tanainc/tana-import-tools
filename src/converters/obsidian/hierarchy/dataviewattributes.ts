import { isEmptySpace } from '../markdown/emptySpace';
import { nextNewLine } from '../markdown/newline';
import { Hierarchy, HierarchyType } from './markdownNodes';

export function findDataViewAttributeSliceStartPosition(curPosition: number) {
  return curPosition;
}

export function findDataViewSliceEndPosition(content: string, curPosition: number) {
  return nextNewLine(content, curPosition);
}

export function detectDataViewAttributeHierarchy(content: string, curPosition: number): Hierarchy | null {
  //TODO: dont need to search newline again later
  //TODO: think through if this approach makes sense in general, now for codeblocks and for dataviewattributes - inline attributes might need something else
  const newline = nextNewLine(content, curPosition);
  const line = content.slice(curPosition, newline);
  if (isSoloDataViewAttribute(line)) {
    return { type: HierarchyType.DATAVIEWATTRIBUTE, level: 0 };
  }
  return null;
}

export function isSoloDataViewAttribute(line: string) {
  const splitName = line.split('::');
  return (
    splitName.length === 2 &&
    splitName[0].trim() === splitName[0] &&
    splitName[0] !== '' &&
    splitName[1] !== '' &&
    splitName[1] !== ' ' &&
    isEmptySpace(splitName[1][0])
  );
}
