export enum HierarchyType {
  HEADING = 'Heading',
  OUTLINE = 'Outliner Node',
  PARAGRAPH = 'Paragraph',
}

export interface Hierarchy {
  type: HierarchyType;
  level: number;
}

export interface NodeDescription extends Hierarchy {
  startPos: number;
  endPos: number;
  content: string;
}
