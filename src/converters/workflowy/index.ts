import type { TanaIntermediateFile } from '../../types/types.js';
import { createTifFile } from '../createTifFile.js';
import { SourceGraph, SourceNode, ConversionSummary } from '../sourceGraph.js';
import { idgenerator } from '../../utils/utils.js';
import { opml2js, Sub, TheOutline } from './opml2js.js';

export class WorkflowyConverter {
  private nodesForImport: Map<string, SourceNode> = new Map();

  private summary: ConversionSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  convert(fileContent: string): TanaIntermediateFile | undefined {
    const graph = this.parse(fileContent);
    return graph && createTifFile(graph);
  }

  parse(fileContent: string): SourceGraph | undefined {
    const outline: TheOutline = opml2js(fileContent);
    if (!outline) {
      return undefined;
    }

    const rootLevelNodes: SourceNode[] = [];
    for (const sub of outline.opml.body.subs) {
      rootLevelNodes.push(this.createTanaNode(sub));
    }

    this.summary.topLevelNodes = rootLevelNodes.length;
    const home = rootLevelNodes.map((node) => node.uid);

    return {
      summary: this.summary,
      roots: [...rootLevelNodes],
      homeIds: home,
    };
  }

  private createTanaNode(sub: Sub): SourceNode {
    const nodeForImport: SourceNode = {
      uid: idgenerator(),
      name: sub.text,
      description: sub.note,
      children: [],
      createdAt: new Date().getTime(),
      editedAt: new Date().getTime(),
      type: 'node',
      todoState: sub._complete ? 'done' : undefined,
    };

    this.nodesForImport.set(nodeForImport.uid, nodeForImport);
    this.summary.totalNodes += 1;

    if (sub.subs) {
      nodeForImport.children = sub.subs.map((s) => this.createTanaNode(s));
    } else {
      this.summary.leafNodes += 1;
    }
    return nodeForImport;
  }
}
