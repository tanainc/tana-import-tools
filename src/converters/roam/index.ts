import {
  NodeType,
  TanaIntermediateAttribute,
  TanaIntermediateNode,
  TanaIntermediateFile,
  TanaIntermediateSummary,
} from '../../types/types.js';
import {
  enrichRoam,
  findGroups,
  getBracketLinks,
  getCodeIfCodeblock,
  idgenerator,
  isIndexWithinBackticks,
} from '../../utils/utils.js';
import { IConverter } from '../IConverter.js';
import {
  getAttributeDefinitionsFromName,
  getValueForAttribute,
  hasField,
  hasImages,
  dateStringToUSDateUID,
  dateStringToYMD,
} from '../common.js';
import { isDone, isTodo, replaceRoamSyntax, setNodeAsDone, setNodeAsTodo } from './roamUtils.js';

type RoamNode = {
  uid: string;
  string: string;
  title: string;
  children?: RoamNode[];
  refs?: { uid: string }[];
  'create-time': number;
  'edit-time': number;
};

const DATE_REGEX = /^\w+\s\d{1,2}\w{2},\s\d+$/;

export class RoamConverter implements IConverter {
  private nodesForImport: Map<string, TanaIntermediateNode> = new Map();
  private originalNodeNames: Map<string, string> = new Map();
  private attrMap: Map<string, TanaIntermediateAttribute> = new Map();

  private topLevelMap: Map<string, TanaIntermediateNode> = new Map();

  private summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  };

  convert(fileContent: string): TanaIntermediateFile | undefined {
    const rootLevelNodes: TanaIntermediateNode[] = [];
    try {
      const nodes: RoamNode[] = JSON.parse(fileContent);
      for (let i = 0; i < nodes.length; i++) {
        const node = this.roamToIntermediate(nodes[i], undefined);
        if (node) {
          rootLevelNodes.push(node);
        }
      }

      // all nodes are now created, let's fix any broken links or missing refs
      for (const n of this.nodesForImport) {
        const nodeForImport = n[1];
        if (nodeForImport.type !== 'codeblock') {
          // create any broken links and add them to references
          const newNodes = this.fixBrokenLinks(nodeForImport);
          if (newNodes) {
            rootLevelNodes.push(...newNodes);
          }

          // normalize the links
          this.normalizeLinksAndSetAliases(nodeForImport);

          nodeForImport.name = enrichRoam(nodeForImport.name);
        }
      }
    } catch (error) {
      console.error('Invalid json?', error);
      return undefined;
    }

    const file: TanaIntermediateFile = {
      version: 'TanaIntermediateFile V0.1',
      summary: this.summary,
      nodes: rootLevelNodes,
      attributes: [...this.attrMap.values()],
    };

    return file;
  }

  private extractMetaNodeContentAndGetNumRemaningChildren(
    theMetaNode: RoamNode,
    parentNode: TanaIntermediateNode,
  ): number {
    const movedChildren: string[] = [];
    if (theMetaNode.children) {
      for (const child of theMetaNode.children) {
        if (child.string.includes('::')) {
          const c = this.roamToIntermediate(child, parentNode);
          if (c && parentNode.children) {
            parentNode.children.push(c);
            movedChildren.push(child.uid);
          }
        }
      }
    }

    // remove the children we outdented
    theMetaNode.children = theMetaNode.children?.filter((id) => !movedChildren.find((c) => c === id.uid));

    return theMetaNode.children?.length || 0;
  }

  // convers "foo::bar bas::bam" into two fileds with values
  private convertToField(nodeWithField: TanaIntermediateNode, parentNode: TanaIntermediateNode) {
    const fullNodeTitle = nodeWithField.name;

    // if we have more fields this will be unset after each created field
    let currentFiledNode: TanaIntermediateNode | undefined = nodeWithField;

    const attriuteDefintions = getAttributeDefinitionsFromName(currentFiledNode.name);

    if (!attriuteDefintions.length) {
      return;
    }

    // we suport foo::bar and bam::bim on the same line
    for (const attrDef of attriuteDefintions) {
      const currentFieldValues = [];

      if (!currentFiledNode) {
        // create a new field since we have multiple
        currentFiledNode = this.createNodeForImport({
          uid: idgenerator(),
          name: attrDef,
          createdAt: nodeWithField.createdAt,
          editedAt: nodeWithField.editedAt,
        });
        if (parentNode && parentNode.children) {
          parentNode.children.push(currentFiledNode);
        }
      } else {
        currentFiledNode.name = attrDef;
      }
      currentFiledNode.type = 'field';

      const attrValue = getValueForAttribute(attrDef, fullNodeTitle) || '';

      const links = getBracketLinks(attrValue, false);
      let remainingAttrValue = attrValue;

      for (const link of links) {
        if (link.match(DATE_REGEX)) {
          continue;
        }

        remainingAttrValue = remainingAttrValue.replace(`[[${link}]]`, '').trim();
      }

      const wasLinksOnly = remainingAttrValue.length === 0;

      if (wasLinksOnly) {
        // create node of type field, add values as children
        for (const link of links) {
          currentFieldValues.push(
            this.createNodeForImport({
              uid: idgenerator(),
              name: `[[${link}]]`, // We link to [[Peter Pan]] etc. It should be found by broken refs later
              createdAt: currentFiledNode.createdAt,
              editedAt: currentFiledNode.editedAt,
              parentNode: currentFiledNode.uid,
            }),
          );
        }
      } else {
        currentFieldValues.push(
          this.createNodeForImport({
            uid: idgenerator(),
            name: attrValue,
            createdAt: currentFiledNode.createdAt,
            editedAt: currentFiledNode.editedAt,
            parentNode: currentFiledNode.uid,
          }),
        );
      }

      if (!currentFiledNode.children) {
        currentFiledNode.children = [];
      }
      for (const f of currentFieldValues) {
        currentFiledNode.children.push(f);
      }

      this.ensureAttrMapIsUpdated(currentFiledNode);
      if (!parentNode) {
        throw new Error('Cannot create fields without a parent node');
      }

      currentFiledNode = undefined;
    }
  }

  private createNodeForImport(n: {
    parentNode?: string;
    uid: string;
    name: string;
    createdAt: number;
    editedAt: number;
    type?: NodeType;
    url?: string;
    refs?: string[];
  }): TanaIntermediateNode {
    const nodeForImport: TanaIntermediateNode = {
      uid: n.uid,
      name: n.name,
      // we only care about uids for now,
      createdAt: n.createdAt,
      editedAt: n.editedAt,
      type: n.type || 'node',
      mediaUrl: n.url,
    };

    nodeForImport.refs = n.refs || [];

    // Fix any block refs that are not set
    findGroups(nodeForImport.name, '(((', ')))').forEach((g) => {
      if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
        if (!nodeForImport.refs) {
          nodeForImport.refs = [];
        }
        nodeForImport.refs.push(g.content);
      }
    });

    findGroups(nodeForImport.name, '((', '))').forEach((g) => {
      // make sure we do not insert anything invalid.
      if (!g.content.includes('(')) {
        if (!nodeForImport.refs || !nodeForImport.refs.includes(g.content)) {
          if (!nodeForImport.refs) {
            nodeForImport.refs = [];
          }
          nodeForImport.refs.push(g.content);
        }
      }
    });

    if (!n.parentNode) {
      this.topLevelMap.set(n.name, nodeForImport);
    }
    this.nodesForImport.set(n.uid, nodeForImport);
    this.originalNodeNames.set(n.uid, nodeForImport.name);
    return nodeForImport;
  }

  private roamToIntermediate(node: RoamNode, parentNode?: TanaIntermediateNode): TanaIntermediateNode | undefined {
    const createdChildNodes: TanaIntermediateNode[] = [];

    if (!node.uid) {
      node.uid = node.title;
    }

    if (this.nodesForImport.has(node.uid)) {
      return;
    }

    let nameToUse = node.title || node.string;

    if (nameToUse === undefined) {
      nameToUse = '';
    }

    // These nodes are big and mostly useless for Tana, so we skip them
    if (
      [
        '{{{[[roam/js]]}}}',
        '{{[[roam/js]]}}',
        'roam/js',
        '{{{[[roam/css]]}}}',
        '{{[[roam/css]]}}',
        'roam/css',
      ].includes(nameToUse.toLowerCase())
    ) {
      return;
    }

    // We outdent any fields in meta nodes in roam. If they are empty after we skip them
    if (parentNode && ['meta', 'meta:'].includes(nameToUse.toLowerCase())) {
      if (this.extractMetaNodeContentAndGetNumRemaningChildren(node, parentNode) === 0) {
        // node is now empty, so we skip it
        return;
      }
    }

    const refs: string[] = [];

    let type: NodeType = 'node';
    if (nameToUse.includes('`')) {
      const code = getCodeIfCodeblock(nameToUse);
      if (code) {
        nameToUse = code;
        type = 'codeblock';
      }
    }

    let url = undefined;
    if (type !== 'codeblock' && hasImages(nameToUse)) {
      const allImages = findGroups(nameToUse, '![](', ')');
      // only one image, so we can create a single node
      if (allImages.length === 1 && `![](${allImages[0].content})` === nameToUse) {
        type = 'image';
        url = allImages[0].content;
        nameToUse = 'image';
      } else {
        // Multiple images, create nodes for them
        for (const image of allImages) {
          const imageUrl = image.content;
          if (!imageUrl) {
            continue;
          }

          const childImage: TanaIntermediateNode = this.createNodeForImport({
            uid: idgenerator(),
            name: 'image',
            createdAt: node['create-time'],
            editedAt: node['edit-time'],
            type: 'image',
            url: imageUrl,
          });

          nameToUse = nameToUse.replace(`![](${imageUrl})`, `[[${childImage.uid}]]`);

          createdChildNodes.push(childImage);
          // add as ref as well since we inline it
          refs.push(childImage.uid);
        }
      }
    }

    const intermediateNode: TanaIntermediateNode = {
      uid: node.uid,
      name: nameToUse,
      children: createdChildNodes,
      createdAt: node['create-time'],
      editedAt: node['edit-time'],
      refs: refs,
      type: type,
      mediaUrl: url,
    };

    if (!parentNode) {
      this.topLevelMap.set(intermediateNode.name, intermediateNode);
      this.summary.topLevelNodes += 1;
    } else {
      this.summary.leafNodes += 1;
    }
    this.summary.totalNodes += 1;

    if (type !== 'codeblock') {
      if (isTodo(intermediateNode.name)) {
        setNodeAsTodo(intermediateNode);
      }

      if (isDone(intermediateNode.name)) {
        setNodeAsDone(intermediateNode);
      }
    }

    // Some dates in Roam do not have the correct date-formatted UID for some reason, so we'll try to fix those
    if (node.title?.match(DATE_REGEX)) {
      const dateUid = dateStringToUSDateUID(node.title);
      if (dateUid) {
        node.uid = dateUid;
      }
    }

    // journal pages in Roam havehave special UID (03-31-2022), we flag these as date nodes
    if (node.uid?.match(/^\d{2}-\d{2}-\d{4}$/gi)) {
      this.summary.calendarNodes += 1;
      intermediateNode.name = node.uid;
      intermediateNode.type = 'date';
    }

    // we only care about uid for refs
    if (node.refs) {
      refs.push(...node.refs.map((r) => r.uid));
    }
    intermediateNode.refs = refs;

    if (intermediateNode.type !== 'codeblock' && hasField(intermediateNode.name)) {
      this.summary.fields += 1;
      if (parentNode) {
        this.convertToField(intermediateNode, parentNode);
      } else {
        console.warn(`Field ${intermediateNode.name}, skipped. Fields on top level not supported yet`);
      }
    }

    if (intermediateNode.type !== 'codeblock') {
      intermediateNode.name = replaceRoamSyntax(intermediateNode.name);
    }

    this.originalNodeNames.set(node.uid, intermediateNode.name);
    this.nodesForImport.set(node.uid, intermediateNode);

    // import any children

    if (node.children) {
      if (!intermediateNode.children) {
        intermediateNode.children = [];
      }
      for (let j = 0; j < node.children.length; j++) {
        const child = this.roamToIntermediate(node.children[j], intermediateNode);
        if (child) {
          intermediateNode.children.push(child);
        }
      }
    }

    return intermediateNode;
  }

  private normalizeLinksAndSetAliases(nodeForImport: TanaIntermediateNode) {
    if (!nodeForImport.refs) {
      return;
    }

    const refsToParse = [...nodeForImport.refs]
      .map((uid) => {
        const n = this.nodesForImport.get(uid);
        if (!n) {
          this.summary.brokenRefs += 1;
        }
        return n;
      })
      .filter((r) => !!r) as TanaIntermediateNode[];

    // we replace nested links first, in case we have links which is present both alone and as part of other links
    refsToParse.sort((a, b) => {
      const aLinkCount = (a.name.match(/\[/g) || []).length;
      const bLinkCount = (b.name.match(/\[/g) || []).length;

      return bLinkCount - aLinkCount;
    });

    // the refs here might nested links, and for cases like [[foo [[bar]]]] we only want to keep the outer one
    for (const refNode of refsToParse) {
      let startIndex = undefined;
      let newNodeName = undefined;
      let alias = undefined;

      const refUID = refNode.uid;

      // the node we are replacing might have already been converted already,lets check that last
      const originalRefName = this.originalNodeNames.get(refUID);

      if (nodeForImport.name.includes(`((${refUID}))`)) {
        const refString = `((${refUID}))`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
      } else if (nodeForImport.name.includes(`#[[${refNode.name}]]`)) {
        const refString = `#[[${refNode.name}]]`;
        alias = '#' + refNode.name;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[${alias}]([[${refUID}]])`);
      } else if (nodeForImport.name.includes(`[[${refNode.name}]]`)) {
        const refString = `[[${refNode.name}]]`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
      } else if (originalRefName && nodeForImport.name.includes(`[[${originalRefName}]]`)) {
        const refString = `[[${originalRefName}]]`;
        startIndex = nodeForImport.name.indexOf(refString);
        newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
      }
      if (startIndex && isIndexWithinBackticks(startIndex, newNodeName)) {
        continue;
      }

      if (startIndex === undefined || startIndex === -1) {
        continue;
      }

      if (newNodeName !== undefined) {
        nodeForImport.name = newNodeName;
      }
    }
  }

  private fixBrokenLinks(nodeForImport: TanaIntermediateNode): TanaIntermediateNode[] {
    const createdNodes: TanaIntermediateNode[] = [];
    // Find all links that are not part of other links
    const outerLinks = getBracketLinks(nodeForImport.name, true);

    // Find all links
    const allLinks = getBracketLinks(nodeForImport.name, false);

    // Links which are only inside other links should be removed
    const linksInsideOtherLinks = outerLinks.length ? allLinks.filter((l) => !outerLinks.includes(l)) : [];

    // Remove any links that are only inside other links, they are not used
    for (let i = 0; i < linksInsideOtherLinks.length; i++) {
      const link = linksInsideOtherLinks[i];
      const refNode = this.findRefByName(link, nodeForImport);
      if (!refNode) {
        continue;
      }

      const index = nodeForImport.refs?.indexOf(refNode.uid) || -1;
      if (nodeForImport.refs && index > -1) {
        nodeForImport.refs.splice(index, 1);
      }
    }

    // Check if we have links without a matching reference
    for (let i = 0; i < outerLinks.length; i++) {
      const link = outerLinks[i];

      // links are not in refs since we want to create inline dates
      // change link to be date:DD-MM-YYYY instead
      if (link?.match(DATE_REGEX)) {
        const dateUid = dateStringToYMD(link);

        if (dateUid) {
          nodeForImport.name = nodeForImport.name.replace(link, 'date:' + dateUid);
          continue;
        }
      }
      if (nodeForImport.children?.some((c) => c.name === link || c.uid === link)) {
        continue;
      }

      let refNode = this.findRefByName(link, nodeForImport);
      if (refNode) {
        continue;
      }

      // we could not find the reference, so let's look for a top level match
      refNode = this.topLevelMap.get(link);
      if (refNode) {
        if (!nodeForImport.refs) {
          nodeForImport.refs = [];
        }
        nodeForImport.refs.push(refNode.uid);
        continue;
      }
      if (link === 'roam/js' || link === 'roam/css' || link === '{{[[roam/js]]}}') {
        continue;
      }

      // Still not found, so we create it in stash.
      refNode = this.createNodeForImport({
        uid: idgenerator(),
        name: link,
        createdAt: nodeForImport.createdAt,
        editedAt: nodeForImport.editedAt,
        parentNode: undefined,
        refs: nodeForImport.refs, // we do not want to add aliases
      });

      if (!nodeForImport.refs) {
        nodeForImport.refs = [];
      }
      nodeForImport.refs.push(refNode.uid);
      createdNodes.push(refNode);
    }

    // fix broken hashtag links
    if (nodeForImport.name.includes('#')) {
      const re = /#\S+/g;
      const allTags = [...nodeForImport.name.matchAll(re)].filter((t) => {
        if (t.index === undefined) {
          return false;
        }

        if (isIndexWithinBackticks(t.index, nodeForImport.name)) {
          return false;
        }
        // Skip if we have anything but a whitespace before the #
        const signBeforeHash = nodeForImport.name.substring(t.index - 1, t.index);

        return !signBeforeHash || signBeforeHash === ' ';
      });

      if (allTags) {
        for (const tag of allTags) {
          // Strips leading #, and a rather crude removal of trailing questionmarks, like for "Seen #topic?"
          const onlyTagName = tag[0].substring(1).replace('?', '');

          // Do not create nodes for tags that are followed by links, or ## and #>
          if (tag[0].startsWith('#[[') || onlyTagName === '#' || onlyTagName === '>') {
            continue;
          }

          let refNode = this.topLevelMap.get(onlyTagName);

          if (refNode) {
            // ensure we update refs if not present
            if (!nodeForImport.refs || !nodeForImport.refs.includes(refNode.uid)) {
              if (!nodeForImport.refs) {
                nodeForImport.refs = [];
              }
              nodeForImport.refs.push(refNode.uid);
            }

            nodeForImport.name = nodeForImport.name.replace('#' + onlyTagName, `[#${onlyTagName}]([[${refNode.uid}]])`);
            continue;
          }

          // The hashtag points to something we do not have a node for
          refNode = this.createNodeForImport({
            uid: idgenerator(),
            name: onlyTagName,
            createdAt: nodeForImport.createdAt,
            editedAt: nodeForImport.editedAt,
          });

          // ensure the newly created node is added to refs
          if (!nodeForImport.refs?.includes(refNode.uid)) {
            if (!nodeForImport.refs) {
              nodeForImport.refs = [];
            }
            nodeForImport.refs.push(refNode.uid);
          }

          nodeForImport.name = nodeForImport.name.replace('#' + onlyTagName, `[#${onlyTagName}]([[${refNode.uid}]])`);
          createdNodes.push(refNode);
        }
      }
    }
    return createdNodes;
  }

  private ensureAttrMapIsUpdated(node: TanaIntermediateNode): void {
    if (!node.name) {
      return;
    }

    if (node.type !== 'field') {
      throw new Error('Trying to get attr def for non-field node');
    }

    let intermediateAttr: TanaIntermediateAttribute | undefined = this.attrMap.get(node.name);

    if (!intermediateAttr) {
      intermediateAttr = {
        name: node.name,
        values: [],
        count: 0,
      };
    }

    if (node.children) {
      const newValues: string[] = node.children
        .map((c) => this.nodesForImport.get(c.uid)?.name)
        .filter((c) => c !== undefined) as string[];
      intermediateAttr.values.push(...newValues);

      intermediateAttr.count++;
    }

    this.attrMap.set(node.name, intermediateAttr);
  }

  private findRefByName(refName: string, node: TanaIntermediateNode): TanaIntermediateNode | undefined {
    if (!node.refs) {
      return;
    }
    for (const uid of node.refs) {
      const refNode = this.nodesForImport.get(uid);
      if (!refNode) {
        continue;
      }

      if (refNode.name === refName) {
        return refNode;
      }

      const originalName = this.originalNodeNames.get(refNode.uid);
      if (originalName === refName) {
        return refNode;
      }
    }
    return undefined;
  }
}
