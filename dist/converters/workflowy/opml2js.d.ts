export type TheOutline = {
    opml: {
        head: {
            title: string;
            ownerEmail: string;
        };
        body: {
            subs: Sub[];
        };
    };
};
export type Sub = {
    text: string;
    subs?: Sub[];
    note?: string;
    _complete?: boolean;
};
export declare function opml2js(opmlString: string): TheOutline;
