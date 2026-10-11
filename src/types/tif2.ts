/** TIF2 imports create a new workspace. See docs/tif2.md for import semantics. */
export type TanaIntermediateFileV2 = {
  version: 'TanaIntermediateFile V2';
  contents: {
    workspace?: TanaIntermediateRegularNodeV2;
    inbox?: TanaIntermediateRegularNodeV2;
    library?: TanaIntermediateRegularNodeV2;
    schema?: TanaIntermediateRegularNodeV2;
    additionalRoots?: TanaIntermediateNodeV2[];
  };
};

/** A uid resolves only within the file; an id can also link to an existing node. */
export type TanaIntermediateIdentifierV2 = { id: string; uid?: never } | { uid: string; id?: never };

type ReferenceMetadataV2<Node> = Node extends unknown ? Partial<Omit<Node, 'id' | 'uid' | 'isRef'>> : never;

/** Exports may carry node metadata on references; the importer reads only identity and alias. */
export type TanaIntermediateReferenceV2 = TanaIntermediateIdentifierV2 &
  (
    | ({ isRef: true } & ReferenceMetadataV2<TanaIntermediateOwnedNodeV2>)
    | {
        type: 'external';
        isRef?: true;
        alias?: string;
        nameParts?: TanaIntermediateNamePartV2[];
        workspaceId?: string;
      }
  );

export type TanaIntermediateNamePartV2 =
  | {
      type: 'text';
      text: string;
      formats?: ('bold' | 'underline' | 'strikethrough' | 'italic' | 'highlight' | 'code')[];
    }
  | { type: 'node'; nodeId: string }
  | { type: 'date'; date: string }
  | { type: 'user'; user: string }
  | { type: 'link'; text: string; url: string };

type NameV2 = { name?: string; nameParts?: never } | { name?: never; nameParts?: TanaIntermediateNamePartV2[] };

type OwnedV2 = NameV2 & {
  /** Source ID. The imported copy receives a new ID. */
  id?: string;
  /** File-local label for references to the imported copy. */
  uid?: string;
  isRef?: false;
  description?: string;
  alias?: string;
  tags?: TanaIntermediateTagReferenceV2[];
  inlineNodes?: Record<string, TanaIntermediateNodeV2>;
  isDone?: boolean;
  isSection?: boolean;
  transcripts?: TanaIntermediateTranscriptV2[];
  /** Export metadata. Omitted content cannot be recovered by importing. */
  childrenOmitted?: number;
  /** Export metadata. This does not choose the destination workspace. */
  workspaceId?: string;
};

export type TanaIntermediateRegularNodeV2 = OwnedV2 & {
  type?: 'node';
  children?: TanaIntermediateNodeV2[];
};

export type TanaIntermediateTemplateV2 = OwnedV2 & {
  type: 'template';
  extends?: (string | TanaIntermediateIdentifierV2)[];
  children?: TanaIntermediateNodeV2[];
  /** Appearance metadata from exports; the importer does not restore it. */
  color?: string;
  avatar?: { type: 'string'; string: string } | { type: 'image'; url: string } | { type: 'icon'; id: string };
  backgroundImageUrl?: string;
};

export type TanaIntermediateTagReferenceV2 =
  | string
  | TanaIntermediateIdentifierV2
  | (TanaIntermediateTemplateV2 & TanaIntermediateIdentifierV2)
  | TanaIntermediateReferenceV2;

export type TanaIntermediateDataTypeV2 =
  | 'list'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'user'
  | 'instance'
  | 'formula'
  | 'url'
  | 'email'
  | 'options';

export type TanaIntermediateAttributeDefV2 = OwnedV2 & {
  type: 'attributeDef';
  dataType?: TanaIntermediateDataTypeV2;
  fixedOptionIds?: (string | TanaIntermediateIdentifierV2)[];
};

export type TanaIntermediateTupleV2 = OwnedV2 & {
  type: 'tuple';
  attributeDef:
    | string
    | TanaIntermediateIdentifierV2
    | TanaIntermediateReferenceV2
    | (TanaIntermediateAttributeDefV2 &
        ({ id: string } | { uid: string }) &
        ({ name: string } | { nameParts: TanaIntermediateNamePartV2[] }));
  values: TanaIntermediateValueV2[];
};

export type TanaIntermediateValueV2 =
  | TanaIntermediateNodeV2
  | { type: 'computedValue'; value: string }
  | { type: 'checkbox'; checked: boolean };

export type TanaIntermediateCodeBlockV2 = OwnedV2 & {
  type: 'codeBlock';
  content: string;
  language?: string;
  /** Set true for literal source. Otherwise HTML entities in content are decoded. */
  plainText?: boolean;
  children?: TanaIntermediateNodeV2[];
  /** Export metadata; the importer cannot restore truncated source. */
  truncated?: boolean;
  byteCount?: number;
};

export type TanaIntermediateUrlV2 = OwnedV2 & {
  type: 'url';
  url?: string;
  children?: TanaIntermediateNodeV2[];
};

export type TanaIntermediateVisualV2 = OwnedV2 & {
  type: 'visual';
  url: string;
  /** Export metadata. The importer creates a media node from url. */
  visualType?: 'image' | 'video';
  children?: TanaIntermediateNodeV2[];
};

export type TanaIntermediateSearchV2 = OwnedV2 & {
  type: 'search';
  children?: TanaIntermediateNodeV2[];
};

export type TanaIntermediateJournalPartV2 = OwnedV2 & {
  type: 'journalPart';
  /** Export metadata. Journal parts import as ordinary outline nodes. */
  date?: string;
  granularity?: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  children?: TanaIntermediateNodeV2[];
};

export type TanaIntermediateChatV2 = OwnedV2 & {
  type: 'chat';
  content: TanaIntermediateNodeV2[];
  replies?: (TanaIntermediateChatV2 | TanaIntermediateReferenceV2)[];
  /** Export metadata. Chat messages import as a static outline. */
  author?: { type: 'user' | 'bot'; name: string };
};

export type TanaIntermediateTranscriptV2 = {
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

export type TanaIntermediateOwnedNodeV2 =
  | TanaIntermediateRegularNodeV2
  | TanaIntermediateTemplateV2
  | TanaIntermediateAttributeDefV2
  | TanaIntermediateTupleV2
  | TanaIntermediateCodeBlockV2
  | TanaIntermediateUrlV2
  | TanaIntermediateVisualV2
  | TanaIntermediateSearchV2
  | TanaIntermediateJournalPartV2
  | TanaIntermediateChatV2;

export type TanaIntermediateNodeV2 = TanaIntermediateOwnedNodeV2 | TanaIntermediateReferenceV2;
