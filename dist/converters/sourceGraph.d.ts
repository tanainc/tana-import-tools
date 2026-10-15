/** Parsed source data used while resolving links and collecting conversion statistics. */
export type SourceGraph = {
    summary: ConversionSummary;
    roots: SourceNode[];
    homeIds?: string[];
    fields?: SourceField[];
    tags?: SourceTag[];
};
export type ConversionSummary = {
    leafNodes: number;
    topLevelNodes: number;
    totalNodes: number;
    calendarNodes: number;
    fields: number;
    brokenRefs: number;
};
export type SourceField = {
    name: string;
    values: string[];
    count: number;
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
    description?: string;
    children?: SourceNode[];
    refs?: string[];
    createdAt: number;
    editedAt: number;
    type: SourceNodeType;
    mediaUrl?: string;
    codeLanguage?: string;
    supertags?: string[];
    flags?: SourceFlag[];
    viewType?: SourceView;
    todoState?: 'todo' | 'done';
};
