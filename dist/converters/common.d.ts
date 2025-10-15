export declare function hasField(node: string): boolean;
export declare function hasImages(name: string): boolean;
/**
 * Convert a date to YYYY-MM-DD format, used for Tana date objects (links) and journal pages.
 * @param date
 */
export declare function convertDateToTanaDateStr(date: Date): string;
export declare function getValueForAttribute(fieldName: string, node: string): string | undefined;
export declare function getAttributeDefinitionsFromName(node: string): string[];
export declare function findPreceedingAlias(nodeName: string, aliasEndIndex: number): string | undefined;
