/**
 * - Each <note> is converted to a Tana node.
 * - The <content> of the <note> has items that are converted to Tana nodes.
 * - A <note> with a <title> that ends with a date like so " - MM/DD/YYYY" and <note-attribute>.<source>=daily.note is converted to a corresponding Tana calendar node.
 * - Images are base64 encoded in enex
 *
 * More details on <content> handling:
 * - Indented nodes (check padding-left styling) are converted to child nodes
 * - Bulleted lists (<ul>) are converted to Tana nodes with children
 * - Unsupported tana features like <hr>, comments etc. are ignored
 * - <table> are converted to tana nodes with viewType=table and the first row should have each column made into fields
 * - links to evernote://... are converted to Tana references if the target note exists
 * - code blocks have style --en-codeblock:true; and language is specified with --en-syntaxLanguage:[language];
 */
import { TanaIntermediateFile } from '../../types/types.js';
import { IConverter } from '../IConverter.js';
export declare class EvernoteConverter implements IConverter {
    private parser;
    private summary;
    private guidToUid;
    private titleToUid;
    private attrMap;
    convert(fileContent: string): TanaIntermediateFile | undefined;
    private normalizeNote;
    private convertNote;
    private convertContent;
    private convertBlockElement;
    private convertTable;
    private collectCells;
    private processList;
    private convertImageElement;
    private serializeInline;
    private serializeChildren;
    private resolveEvernoteLink;
    private getIndentLevel;
    private reconcileStackForIndent;
    private addField;
    private recordAttribute;
    private createNode;
    private extractResources;
    private extractTasks;
    private collectEvernoteLinkGuids;
    private extractContent;
    private parseEvernoteTimestamp;
    private tryParseDailyNoteDate;
    private tryConvertInlineDate;
    private formatUtcTimestamp;
    private computeSummary;
    private ensureArray;
    private extractTaskGroupId;
    private extractNodeLevelId;
    private getStyleProperty;
}
