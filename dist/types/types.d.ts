/** Tana Intermediate Format 2.1. See docs/tif2.md for identity and ownership rules. */
export type TanaIntermediateFile = {
    version: 'TanaIntermediateFile V2.1';
    contents: {
        workspace?: TanaIntermediateRegularNode;
        inbox?: TanaIntermediateRegularNode;
        library?: TanaIntermediateRegularNode;
        schema?: TanaIntermediateRegularNode;
        additionalRoots?: TanaIntermediateNode[];
    };
};
export type TanaIntermediateIdentifier = {
    id: string;
    uid?: never;
} | {
    uid: string;
    id?: never;
};
type DeclarationIdentity = {
    id: string;
    uid?: string;
} | {
    uid: string;
    id?: string;
};
export type TanaIntermediateNamePart = {
    type: 'text';
    text: string;
    formats?: ('bold' | 'italic' | 'underline' | 'strikethrough' | 'highlight' | 'code')[];
} | {
    type: 'node';
    nodeId: string;
} | {
    type: 'date';
    date: string;
} | {
    type: 'user';
    user: string;
} | {
    type: 'link';
    url: string;
    text: string;
};
type Name = {
    name: string;
    nameParts?: never;
} | {
    name?: never;
    nameParts?: TanaIntermediateNamePart[];
};
type NodeMetadata = {
    id?: string;
    uid?: string;
    description?: string;
    alias?: string;
    /** Export metadata. This does not choose the destination workspace. */
    workspaceId?: string;
    /** Content omitted from an export cannot be recovered by importing. */
    childrenOmitted?: number;
};
type OwnedNode = NodeMetadata & Name & {
    isRef?: false;
    tags?: TanaIntermediateTagReference[];
    inlineNodes?: Record<string, TanaIntermediateNode>;
    isSection?: boolean;
    isDone?: boolean;
    transcripts?: TanaIntermediateTranscript[];
};
export type TanaIntermediateNodeType = 'node' | 'field' | 'fieldDefinition' | 'supertag' | 'codeBlock' | 'url' | 'visual' | 'search' | 'journalPart' | 'chat';
type AsReference<Node> = Node extends unknown ? TanaIntermediateIdentifier & Partial<Omit<Node, 'id' | 'uid' | 'isRef'>> & {
    isRef: true;
} : never;
export type TanaIntermediateReference = AsReference<TanaIntermediateOwnedNode>;
export type TanaIntermediateExternalReference = TanaIntermediateIdentifier & {
    type: 'external';
    isRef?: true;
    alias?: string;
    nameParts?: TanaIntermediateNamePart[];
    workspaceId?: string;
};
export type TanaIntermediateRegularNode = OwnedNode & {
    type?: 'node';
    children?: TanaIntermediateNode[];
};
export type TanaIntermediateBaseType = 'meeting' | 'person' | 'task' | 'organization' | 'location' | 'event' | 'project' | 'topic' | 'article' | 'memo' | 'reflection' | 'day' | 'week';
export type TanaIntermediateSupertag = OwnedNode & {
    type: 'supertag';
    extends?: (string | TanaIntermediateIdentifier)[];
    children?: TanaIntermediateNode[];
    /** Readable export labels for built-in base types. Import uses extends. */
    baseTypes?: TanaIntermediateBaseType[];
    /** Appearance metadata from exports; the importer does not restore it. */
    color?: string;
    avatar?: {
        type: 'string';
        string: string;
    } | {
        type: 'image';
        url: string;
    } | {
        type: 'icon';
        id: string;
    };
    backgroundImageUrl?: string;
};
export type TanaIntermediateTagReference = string | TanaIntermediateIdentifier | (Omit<TanaIntermediateSupertag, 'isRef'> & TanaIntermediateIdentifier & {
    isRef?: boolean;
}) | TanaIntermediateExternalReference;
export type TanaIntermediateDataType = 'list' | 'number' | 'integer' | 'boolean' | 'date' | 'user' | 'instance' | 'formula' | 'url' | 'email' | 'options';
export type TanaIntermediateFieldDefinition = OwnedNode & DeclarationIdentity & {
    type: 'fieldDefinition';
    dataType?: TanaIntermediateDataType;
    fixedOptionIds?: (string | TanaIntermediateIdentifier)[];
    children?: never;
};
export type TanaIntermediateFieldReference = string | (TanaIntermediateIdentifier & {
    type?: never;
    isRef?: true;
    name?: never;
    nameParts?: never;
    inlineNodes?: never;
}) | (TanaIntermediateIdentifier & Name & {
    type: 'fieldDefinition';
    isRef: true;
    dataType?: TanaIntermediateDataType;
    description?: string;
    fixedOptionIds?: (string | TanaIntermediateIdentifier)[];
    inlineNodes?: never;
    workspaceId?: string;
}) | TanaIntermediateExternalReference;
export type TanaIntermediateField = NodeMetadata & {
    type: 'field';
    isRef?: false;
    field: TanaIntermediateFieldReference;
    values: TanaIntermediateValue[];
    inlineNodes?: Record<string, TanaIntermediateNode>;
    children?: never;
};
export type TanaIntermediateValue = TanaIntermediateNode | string | number | boolean | {
    type: 'computedValue';
    value: string;
} | {
    type: 'checkbox';
    checked: boolean;
};
export type TanaIntermediateCodeBlock = OwnedNode & {
    type: 'codeBlock';
    content: string;
    language?: string;
    /** True for literal source. Otherwise HTML entities in content are decoded. */
    plainText?: boolean;
    children?: TanaIntermediateNode[];
    truncated?: boolean;
    byteCount?: number;
};
export type TanaIntermediateUrl = OwnedNode & {
    type: 'url';
    url?: string;
    children?: TanaIntermediateNode[];
};
export type TanaIntermediateVisual = OwnedNode & {
    type: 'visual';
    url: string;
    visualType?: 'image' | 'video';
    children?: TanaIntermediateNode[];
};
export type TanaIntermediateSearch = OwnedNode & {
    type: 'search';
    children?: TanaIntermediateNode[];
};
export type TanaIntermediateJournalPart = OwnedNode & {
    type: 'journalPart';
    date?: string;
    granularity?: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
    children?: TanaIntermediateNode[];
};
export type TanaIntermediateChat = OwnedNode & {
    type: 'chat';
    content: TanaIntermediateNode[];
    replies?: (TanaIntermediateChat | TanaIntermediateReference | TanaIntermediateExternalReference)[];
    author?: {
        type: 'user' | 'bot';
        name: string;
    };
};
export type TanaIntermediateTranscript = {
    id: string;
    title: string;
    source: 'field' | 'sourceMaterial' | 'previous';
    lines: {
        id: string;
        text: string;
        speaker?: string;
        startTime?: string;
        endTime?: string;
    }[];
};
export type TanaIntermediateOwnedNode = TanaIntermediateRegularNode | TanaIntermediateSupertag | TanaIntermediateFieldDefinition | TanaIntermediateField | TanaIntermediateCodeBlock | TanaIntermediateUrl | TanaIntermediateVisual | TanaIntermediateSearch | TanaIntermediateJournalPart | TanaIntermediateChat;
export type TanaIntermediateNode = TanaIntermediateOwnedNode | TanaIntermediateReference | TanaIntermediateExternalReference;
export {};
