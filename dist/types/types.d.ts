export type TanaIntermediateFile = {
    version: 'TanaIntermediateFile V0.1';
    summary: TanaIntermediateSummary;
    nodes: TanaIntermediateNode[];
    attributes?: TanaIntermediateAttribute[];
    supertags?: TanaIntermediateSupertag[];
};
export type TanaIntermediateSummary = {
    leafNodes: number;
    topLevelNodes: number;
    totalNodes: number;
    calendarNodes: number;
    fields: number;
    brokenRefs: number;
};
export type TanaIntermediateAttribute = {
    name: string;
    values: string[];
    count: number;
    dataType?: 'any' | 'url' | 'email' | 'number' | 'date' | 'checkbox';
};
export type TanaIntermediateSupertag = {
    uid: string;
    name: string;
};
export type NodeType = 'field' | 'image' | 'codeblock' | 'node' | 'date';
export type TanaIntermediateNode = {
    uid: string;
    /**
     * Contents of the node.
     *
     * For type=date this must contain the date : "MM-DD-YYYY"
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
    children?: TanaIntermediateNode[];
    refs?: string[];
    createdAt: number;
    editedAt: number;
    type: NodeType;
    mediaUrl?: string;
    codeLanguage?: string;
    supertags?: string[];
    todoState?: 'todo' | 'done';
};
