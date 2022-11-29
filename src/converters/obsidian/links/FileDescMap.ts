import { basename } from '../filesystem/CustomFileSystemAdapter';
import { dateStringToDateUID } from './dateLinks';

function isPath(searchStr: string) {
  try {
    return basename(searchStr) !== searchStr;
  } catch (error) {
    console.log('Error in isPath: ' + searchStr);
    throw 'Error in isPath: ' + searchStr;
  }
}

//using a mix of fileName and filePath in the links might lead to random results
//usually obsidian changes the links properly
export class FileDescMap<Data> {
  nameWasCalledAsFile: string[] = [];
  pathMap = new Map<string, Data>();
  nameMap = new Map<string, Data>();

  //TODO: make a proper hook approach to catching dateUIDs
  /**
   * Should only be called once per file for this instance. Top level files need to be called first to disambiguate. A top level file will have path === name.
   */
  accessAsFile(fileName: string, filePath: string, defaultData: (dateUID?: string) => Data, dailyNoteFormat: string) {
    //if this is a daly note, we need to track the re-formatted date as its filename because that is how it will be saved
    const dateUID = dateStringToDateUID(fileName, dailyNoteFormat);
    if (dateUID) {
      fileName = dateUID;
    }

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

    const data = defaultData(dateUID);
    this.pathMap.set(filePath, data);
    if (!this.nameMap.get(fileName)) {
      this.nameMap.set(fileName, data);
    }
    this.nameWasCalledAsFile.push(fileName);
    return data;
  }

  accessAsLink(searchStr: string, defaultData: (dateUID?: string) => Data, dailyNoteFormat: string) {
    const dateUID = dateStringToDateUID(searchStr, dailyNoteFormat);
    if (dateUID) {
      searchStr = dateUID;
    }

    const match = this.findData(searchStr);
    if (match) {
      return match;
    }
    const isPathBool = isPath(searchStr);
    const data = defaultData(dateUID);
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
