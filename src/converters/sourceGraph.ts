/** Parsed source data used while resolving links and collecting conversion statistics. */
export type SourceGraph = {
  // summary of the contents in the file
  summary: ConversionSummary;

  // all nodes
  roots: SourceNode[];

  // Node IDs that will be added to the home node
  homeIds?: string[];

  // all attributes
  fields?: SourceField[];

  // tags found in the source
  tags?: SourceTag[];
};

export type ConversionSummary = {
  // the number of leaf nodes
  leafNodes: number;

  // the number of root level source nodes
  topLevelNodes: number;

  // the total number of nodes found
  totalNodes: number;

  // number of source journal entries
  calendarNodes: number;

  // the number of fields
  fields: number;

  // number of broken references
  brokenRefs: number;
};

export type SourceField = {
  name: string;
  values: string[];
  count: number;
  // will default to any
  dataType?: 'any' | 'url' | 'email' | 'number' | 'date' | 'checkbox';
};

export type SourceTag = {
  uid: string;
  name: string;
};

export type SourceNodeType = 'field' | 'image' | 'codeblock' | 'node' | 'date';

export type SourceFlag = 'section';

export type SourceView = 'list' | 'table';

export type SourceNode = {
  // Source identity used to resolve links before writing the file
  uid: string;

  /**
   * Contents of the node.
   *
   * For type=date this must contain the date : "YYYY-MM-DD"
   *
   * Supported text formatting: **bold** __italic__ ~~striked~~ ^^highlighted^^
   *
   * Link formats:
   * - external content: [See Tana](https://wwww.tana.inc)
   * - internal: [[uid]]
   * - internal with alias: [test page]([[uid]])
   */
  name: string;

  // Description of the node
  description?: string;

  // children
  children?: SourceNode[];

  // reference uids
  refs?: string[];

  // created at timestamp
  createdAt: number;

  // edited at timestamp
  editedAt: number;

  // the various types of nodes we support
  type: SourceNodeType;

  // used for media url
  mediaUrl?: string;

  // for code blocks
  codeLanguage?: string;

  supertags?: string[];

  // for section/heading nodes
  flags?: SourceFlag[];

  viewType?: SourceView;

  // if set, we will create TODO / DONE for this node
  todoState?: 'todo' | 'done';
};
