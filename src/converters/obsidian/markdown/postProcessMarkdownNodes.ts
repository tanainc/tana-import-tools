import { Hierarchy, HierarchyType } from './extractMarkdownNodes';

export function postProcessMarkdownNodes(content: string, hierarchy: Hierarchy) {
  if (hierarchy.type === HierarchyType.OUTLINE) {
    //remove empty prefix
    const processed = content.trimStart();
    if (!isNaN(parseInt(processed[0]))) {
      //if it starts with e.g. "1." we keep the numbering because Tana does not support numbered lists right now
      return processed;
    }
    //remove "* "
    return processed.slice(2);
  }

  if (hierarchy.type === HierarchyType.HEADING) {
    return content.slice(hierarchy.level + 1); //heading symbols and empty space after that
  }

  return content;
}
