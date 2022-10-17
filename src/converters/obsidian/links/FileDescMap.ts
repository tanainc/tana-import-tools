import { basename } from '../filesystem/CustomFileSystemAdapter';

function isPath(searchStr: string) {
  return basename(searchStr) !== searchStr;
}

//using a mix of fileName and filePath in the links might lead to random results
//usually obsidian changes the links properly
export class FileDescMap<Data> {
  nameWasCalledAsFile: string[] = [];
  pathMap = new Map<string, Data>();
  nameMap = new Map<string, Data>();

  /**
   * Should only be called once per file for this instance. Top level files need to be called first to disambiguate. A top level file will have path === name.
   */
  accessAsFile(fileName: string, filePath: string, defaultData: () => Data) {
    const pathMatch = this.pathMap.get(filePath);
    if (pathMatch) {
      if (!this.nameMap.get(fileName)) {
        this.nameMap.set(fileName, pathMatch);
      }
      return pathMatch;
    }
    const nameMatch = this.nameMap.get(fileName);
    //in this case this name-data comes from accessing it as a link first
    if (nameMatch && !this.nameWasCalledAsFile.includes(fileName)) {
      this.pathMap.set(filePath, nameMatch);
      this.nameWasCalledAsFile.push(fileName);
      return nameMatch;
    }

    const data = defaultData();
    this.pathMap.set(filePath, data);
    if (!this.nameMap.get(fileName)) {
      this.nameMap.set(fileName, data);
    }
    this.nameWasCalledAsFile.push(fileName);
    return data;
  }

  accessAsLink(searchStr: string, defaultData: () => Data) {
    const match = this.findData(searchStr);
    if (match) {
      return match;
    }
    const isPathBool = isPath(searchStr);
    const data = defaultData();
    if (isPathBool) {
      this.pathMap.set(searchStr, data);
    } else {
      this.nameMap.set(searchStr, data);
    }
    return data;
  }

  findData(searchStr: string) {
    return this.pathMap.get(searchStr) ?? this.nameMap.get(searchStr);
  }

  /**
   * Includes all data, even if it was only accessed via link.
   */
  getData() {
    return new Set([...this.pathMap.values(), ...this.nameMap.values()]);
  }
}

export type FileDesc = { name?: string; path?: string };
