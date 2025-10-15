import { markdownToHTML, findGroups, getBracketLinks, getCodeIfCodeblock, idgenerator, isIndexWithinBackticks, } from '../../utils/utils.js';
import { hasImages, convertDateToTanaDateStr } from '../common.js';
import { hasDuplicateProperties, isDone, isTodo, replaceLogseqSyntax, setNodeAsDone, setNodeAsTodo, } from './logseqUtils.js';
import { parse, isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
// surmise the date format by the most common format seen
// in the user's journal pages.
const LOGSEQ_DATE_FORMATS = [
    'E, MM/dd/yyyy',
    'E, dd-MM-yyyy',
    'E, dd.MM.yyyy',
    'E, yyyy/MM/dd',
    'EEE, MM/dd/yyyy',
    'EEE, dd-MM-yyyy',
    'EEE, dd.MM.yyyy',
    'EEE, yyyy/MM/dd',
    'EEEE, MM/dd/yyyy',
    'EEEE, dd-MM-yyyy',
    'EEEE, dd.MM.yyyy',
    'EEEE, yyyy/MM/dd',
    'MM-dd-yyyy',
    'MM/dd/yyyy',
    'MMM do, yyyy',
    'MMMM do, yyyy',
    'MM_dd_yyyy',
    'dd-MM-yyyy',
    'do MMM yyyy',
    'do MMMM yyyy',
    'yyyy-MM-dd',
    'yyyy-MM-dd EEEE',
    'yyyy/MM/dd',
    'yyyyMMdd',
    'yyyy_MM_dd',
    'yyyy年MM月dd日',
];
export class LogseqConverter {
    constructor() {
        this.nodesForImport = new Map();
        this.originalNodeNames = new Map();
        this.attrMap = new Map();
        this.topLevelMap = new Map();
        this.summary = {
            leafNodes: 0,
            topLevelNodes: 0,
            totalNodes: 0,
            calendarNodes: 0,
            fields: 0,
            brokenRefs: 0,
        };
    }
    convert(fileContent) {
        const rootLevelNodes = [];
        try {
            const logseq = JSON.parse(fileContent);
            const nodes = logseq.blocks;
            for (let i = 0; i < nodes.length; i++) {
                const node = this.logseqToIntermediate(nodes[i], undefined);
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
                    nodeForImport.name = markdownToHTML(nodeForImport.name);
                }
            }
        }
        catch (error) {
            console.error('Invalid json?', error);
            return undefined;
        }
        const file = {
            version: 'TanaIntermediateFile V0.1',
            summary: this.summary,
            nodes: rootLevelNodes,
            attributes: [...this.attrMap.values()],
        };
        return file;
    }
    extractMetaNodeContentAndGetNumRemaningChildren(theMetaNode, parentNode) {
        var _a, _b;
        const movedChildren = [];
        if (theMetaNode.children) {
            for (const child of theMetaNode.children) {
                if (child.content.includes('::')) {
                    const c = this.logseqToIntermediate(child, parentNode);
                    if (c && parentNode.children) {
                        parentNode.children.push(c);
                        movedChildren.push(child.id);
                    }
                }
            }
        }
        // remove the children we outdented
        theMetaNode.children = (_a = theMetaNode.children) === null || _a === void 0 ? void 0 : _a.filter((id) => !movedChildren.find((c) => c === id.id));
        return ((_b = theMetaNode.children) === null || _b === void 0 ? void 0 : _b.length) || 0;
    }
    convertToField(key, value, node) {
        this.summary.fields += 1;
        const fieldNode = this.createNodeForImport({
            uid: idgenerator(),
            name: key,
            createdAt: node.createdAt,
            editedAt: node.editedAt,
            type: 'field',
        });
        const fieldChildren = [];
        node.children = node.children ? [...node.children, fieldNode] : [fieldNode];
        // arrays as property values are references
        if (Array.isArray(value)) {
            for (const link of value) {
                fieldChildren.push(this.createNodeForImport({
                    uid: idgenerator(),
                    name: `[[${link}]]`, // We link to [[Peter Pan]] etc. It should be found by broken refs later
                    createdAt: fieldNode.createdAt,
                    editedAt: fieldNode.editedAt,
                    parentNode: fieldNode.uid,
                }));
            }
        }
        if (typeof value === 'string' || typeof value === 'number') {
            fieldChildren.push(this.createNodeForImport({
                uid: idgenerator(),
                name: value.toString(),
                createdAt: node.createdAt,
                editedAt: node.editedAt,
            }));
        }
        if (!fieldNode.children) {
            fieldNode.children = [];
        }
        for (const child of fieldChildren) {
            fieldNode.children.push(child);
        }
        this.ensureAttrMapIsUpdated(fieldNode);
    }
    createNodeForImport(n) {
        const nodeForImport = {
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
    logseqToIntermediate(node, parentNode) {
        var _a, _b;
        const createdChildNodes = [];
        if (this.nodesForImport.has(node.id)) {
            return;
        }
        let nameToUse = node['page-name'] || node.content;
        if (nameToUse === undefined) {
            nameToUse = '';
        }
        // Logseq property: heading: 1, 2, 3, etc
        // If header, strip leading #s and whitespace, and set flags: ["section"]
        let isHeader = false;
        // Markdown style header
        if (typeof nameToUse === 'string' && nameToUse.match(/^#+\s+[^#]/)) {
            isHeader = true;
            nameToUse = nameToUse.replace(/^#+\s+/, '');
        }
        // Logseq property style header
        if (node.properties && typeof node.properties === 'object' && 'heading' in node.properties) {
            isHeader = true;
            // Also strip leading #s and whitespace if present
            nameToUse = nameToUse.replace(/^#+\s+/, '');
            // Remove the extraneous 'heading' property so it doesn't get converted to a field
            if (node.properties && typeof node.properties === 'object') {
                // Create a shallow copy to avoid mutating input
                node.properties = Object.assign({}, node.properties);
                delete node.properties.heading;
            }
        }
        if (isHeader) {
            nameToUse = nameToUse.trim();
        }
        // We outdent any fields in meta nodes in roam. If they are empty after we skip them
        if (parentNode && ['meta', 'meta:'].includes(nameToUse.toLowerCase())) {
            if (this.extractMetaNodeContentAndGetNumRemaningChildren(node, parentNode) === 0) {
                // node is now empty, so we skip it
                return;
            }
        }
        const refs = [];
        let type = 'node';
        if (nameToUse.includes('`')) {
            if (nameToUse.startsWith('```')) {
                const newlineIndex = nameToUse.trim().indexOf('\n');
                // strip language type
                if (newlineIndex > 3) {
                    const chars = nameToUse.split('');
                    chars.splice(3, newlineIndex - 3);
                    nameToUse = chars.join('');
                }
            }
            const code = getCodeIfCodeblock(nameToUse);
            if (code) {
                nameToUse = code;
                type = 'codeblock';
            }
        }
        let url = undefined;
        if (hasImages(nameToUse)) {
            const allImages = findGroups(nameToUse, '![](', ')');
            // only one image, so we can create a single node
            if (allImages.length === 1 && `![](${allImages[0].content})` === nameToUse) {
                type = 'image';
                url = allImages[0].content;
                nameToUse = 'image';
            }
            else {
                // Multiple images, create nodes for them
                for (const image of allImages) {
                    const imageUrl = image.content;
                    if (!imageUrl) {
                        continue;
                    }
                    const childImage = this.createNodeForImport({
                        uid: idgenerator(),
                        name: 'image',
                        createdAt: Date.now(),
                        editedAt: Date.now(),
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
        const intermediateNode = {
            uid: node.id,
            name: nameToUse,
            children: createdChildNodes,
            createdAt: Date.now(),
            editedAt: Date.now(),
            refs: refs,
            type: type,
            mediaUrl: url,
        };
        if (isHeader) {
            intermediateNode.flags = ['section'];
        }
        if (!parentNode) {
            this.topLevelMap.set(intermediateNode.name, intermediateNode);
            this.summary.topLevelNodes += 1;
        }
        else {
            this.summary.leafNodes += 1;
        }
        this.summary.totalNodes += 1;
        if (isTodo(intermediateNode.name)) {
            setNodeAsTodo(intermediateNode);
        }
        if (isDone(intermediateNode.name)) {
            setNodeAsDone(intermediateNode);
        }
        const pageName = node['page-name'];
        // journal pages have one of several date formats in logseq
        const pageDate = this.parseFlexibleDate(pageName);
        if (pageDate) {
            this.summary.calendarNodes += 1;
            intermediateNode.name = convertDateToTanaDateStr(pageDate);
            intermediateNode.type = 'date';
        }
        if (intermediateNode.type !== 'codeblock') {
            intermediateNode.name = replaceLogseqSyntax(intermediateNode.name);
        }
        this.originalNodeNames.set(node.id, intermediateNode.name);
        this.nodesForImport.set(node.id, intermediateNode);
        // convert Logseq properties to Tana fields
        if (node.properties) {
            if (node['page-name'] && hasDuplicateProperties(node, (_a = node.children) === null || _a === void 0 ? void 0 : _a[0])) {
                // logseq properties appear to be duplicated in the page node and the first child node
                // if properties are equal, remove first child
                (_b = node.children) === null || _b === void 0 ? void 0 : _b.shift();
            }
            for (const [key, value] of Object.entries(node.properties)) {
                this.convertToField(key, value, intermediateNode);
            }
        }
        // import any children
        if (node.children) {
            if (!intermediateNode.children) {
                intermediateNode.children = [];
            }
            for (let j = 0; j < node.children.length; j++) {
                const child = this.logseqToIntermediate(node.children[j], intermediateNode);
                if (child) {
                    intermediateNode.children.push(child);
                }
            }
        }
        return intermediateNode;
    }
    normalizeLinksAndSetAliases(nodeForImport) {
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
            .filter((r) => !!r);
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
            if (nodeForImport.name.includes(`(((${refUID})))`)) {
                const refString = `(((${refUID})))`;
                startIndex = nodeForImport.name.indexOf(refString);
                newNodeName = nodeForImport.name.split(refString).join(`([[${refUID}]])`);
            }
            else if (nodeForImport.name.includes(`((${refUID}))`)) {
                const refString = `((${refUID}))`;
                startIndex = nodeForImport.name.indexOf(refString);
                newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
            }
            else if (nodeForImport.name.includes(`#[[${refNode.name}]]`)) {
                const refString = `#[[${refNode.name}]]`;
                alias = '#' + refNode.name;
                startIndex = nodeForImport.name.indexOf(refString);
                newNodeName = nodeForImport.name.split(refString).join(`[${alias}]([[${refUID}]])`);
            }
            else if (nodeForImport.name.includes(`[[${refNode.name}]]`)) {
                const refString = `[[${refNode.name}]]`;
                startIndex = nodeForImport.name.indexOf(refString);
                newNodeName = nodeForImport.name.split(refString).join(`[[${refUID}]]`);
            }
            else if (originalRefName && nodeForImport.name.includes(`[[${originalRefName}]]`)) {
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
    fixBrokenLinks(nodeForImport) {
        var _a, _b, _c;
        const createdNodes = [];
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
            const index = ((_a = nodeForImport.refs) === null || _a === void 0 ? void 0 : _a.indexOf(refNode.uid)) || -1;
            if (nodeForImport.refs && index > -1) {
                nodeForImport.refs.splice(index, 1);
            }
        }
        // Check if we have links without a matching reference
        for (let i = 0; i < outerLinks.length; i++) {
            const link = outerLinks[i];
            // links are not in refs since we want to create inline dates
            // change link to be date:YYYY-MM-DD instead
            const linkDate = this.parseFlexibleDate(link);
            if (linkDate) {
                const dateUid = convertDateToTanaDateStr(linkDate);
                nodeForImport.name = nodeForImport.name.replace(link, 'date:' + dateUid);
                continue;
            }
            if ((_b = nodeForImport.children) === null || _b === void 0 ? void 0 : _b.some((c) => c.name === link || c.uid === link)) {
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
                    if (!((_c = nodeForImport.refs) === null || _c === void 0 ? void 0 : _c.includes(refNode.uid))) {
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
    ensureAttrMapIsUpdated(node) {
        if (!node.name) {
            return;
        }
        if (node.type !== 'field') {
            throw new Error('Trying to get attr def for non-field node');
        }
        let intermediateAttr = this.attrMap.get(node.name);
        if (!intermediateAttr) {
            intermediateAttr = {
                name: node.name,
                values: [],
                count: 0,
            };
        }
        if (node.children) {
            const newValues = node.children
                .map((c) => { var _a; return (_a = this.nodesForImport.get(c.uid)) === null || _a === void 0 ? void 0 : _a.name; })
                .filter((c) => c !== undefined);
            intermediateAttr.values.push(...newValues);
            intermediateAttr.count++;
        }
        this.attrMap.set(node.name, intermediateAttr);
    }
    findRefByName(refName, node) {
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
    /**
     * Try every known pattern until one parses cleanly.
     * @returns a valid Date or undefined if no pattern matched.
     */
    parseFlexibleDate(input) {
        if (!input) {
            return;
        }
        for (const fmt of LOGSEQ_DATE_FORMATS) {
            // `parse` returns “Invalid Date” if the string doesn’t fit the mask,
            // so we simply loop until we hit a valid one.                     */
            const candidate = parse(input, fmt, new Date(), { locale: enUS });
            if (isValid(candidate)) {
                return candidate;
            }
        }
    }
}
