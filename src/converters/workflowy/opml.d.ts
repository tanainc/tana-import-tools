// minimal typings for https://github.com/scripting/opmlpackage
type TheOutline = {
  opml: {
    head: {
      title: string;
    };
    body: {
      subs: Sub[];
    };
  };
};

type Sub = {
  text: string;
  subs?: Sub[];
  _complete?: boolean;
};

type OutlineNode = {
  text: string;
};

declare module 'opml' {
  export function parse(buffer: string, callback: (error: string, theOutline: TheOutline) => void): void;
  export function visitAll(theOutline: string, callback: (node: OutlineNode) => void): void;
}
