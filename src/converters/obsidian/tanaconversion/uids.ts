export enum UidRequestType {
  FILE,
  CONTENT,
}

interface UidData {
  type: UidRequestType;
  uid: string;
  obsidianLink: string;
}

export type IdGenerator = () => string;

//all normal ([[fileName]]), file or folder UIDs: <name, UidData>
export type UidTracker = Map<string, UidData>;
