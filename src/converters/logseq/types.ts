export type LogseqFile = {
  version: number;
  blocks: LogseqBlock[];
};

export type LogseqBlock = {
  id: string;
  'page-name': string;
  properties: Record<string, unknown>;
  format: 'markdown';
  children?: LogseqBlock[];
  content: string;
};
