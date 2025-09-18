/**
 * Logseq has two flavors for their terminology for TODOs. The default is
 * NOW/LATER and the second option is TODO/DONE. These are the mappings:
 *
 * LATER = TODO
 * NOW = DOING
 * CANCELED = CANCELED
 * DONE = DONE
 */
const TODO_REGEX = new RegExp(`^(TODO|LATER)\\s+`);
const TODO_OR_DOING_REGEX = new RegExp(`^(TODO|LATER|DOING|NOW)\\s+`);
const DONE_REGEX = new RegExp(`^DONE\\s+`);
const DONE_OR_CANCELED_REGEX = new RegExp(`^(DONE|CANCELED)\\s+`);
export function isTodo(name) {
    return TODO_OR_DOING_REGEX.test(name);
}
export function isDone(name) {
    return DONE_OR_CANCELED_REGEX.test(name);
}
export function setNodeAsTodo(node) {
    node.name = node.name.replace(TODO_REGEX, '');
    // if DOING/NOW treat it as a TODO item but leave the DOING or NOW in the name
    // so it remains clear to the user that it's an in progressk item
    node.todoState = 'todo';
}
export function setNodeAsDone(node) {
    node.name = node.name.replace(DONE_REGEX, '');
    // if canceled, leave the name as is so it remains clear that it's a canceled
    // task to the user, but set todoState to done
    node.todoState = 'done';
}
export function replaceLogseqSyntax(nameToUse) {
    if (nameToUse.includes('{{embed')) {
        // Replace {embed:((id))} with ((id))
        nameToUse = nameToUse.replace(/\{\{embed\s?\(\((.+)\)\)\}\}/, function (match, contents) {
            return `((${contents}))`;
        });
        // Replace {embed:[[name]]} with [[name]]
        nameToUse = nameToUse.replace(/\{\{embed\s?\[\[(.+)\]\]\}\}/, function (match, contents) {
            return `[[${contents}]]`;
        });
    }
    return nameToUse;
}
export function hasDuplicateProperties(parent, child) {
    if (!parent || !child) {
        return false;
    }
    return JSON.stringify(parent.properties) === JSON.stringify(child.properties);
}
