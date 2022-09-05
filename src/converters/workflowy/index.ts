import { TanaIntermediateFile, TanaIntermediateNode, TanaIntermediateSummary } from '../../types/types';
import * as opml from 'opml';
import { idgenerator } from '../../utils/utils';

export class WorkflowyConverter {
  private nodesForImport: Map<string, TanaIntermediateNode> = new Map();

  private summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  convert(fileContent: string): TanaIntermediateFile | undefined {
    let outline: TheOutline | undefined;

    opml.parse(fileContent, (err, theOutline) => {
      if (!err) {
        outline = theOutline;
      }
    });
    if (!outline) {
      return undefined;
    }

    for (const sub of outline.opml.body.subs) {
      this.createTanaNode(sub);
    }

    return {
      version: 'TanaIntermediateFile V0.1',
      summary: this.summary,
      nodes: [...this.nodesForImport.values()],
    };
  }

  private createTanaNode(sub: Sub): TanaIntermediateNode {
    const nodeForImport: TanaIntermediateNode = {
      uid: idgenerator(),
      name: sub.text,
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
