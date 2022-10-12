import { readFileSync } from 'fs';

function readObsidianConfig(vaultPath: string, configName: string): Record<string, string> {
  return JSON.parse(readFileSync(vaultPath + '/.obsidian/' + configName + '.json', 'utf-8'));
}

//relative is not supported
const supportedLinkFormates = ['shortest', 'absolute'];
const defaultLinkFormate = 'shortest';

function readLinkFormat(vaultPath: string) {
  const foundReadStyle = readObsidianConfig(vaultPath, 'app').newLinkFormat ?? defaultLinkFormate;
  if (!supportedLinkFormates.includes(foundReadStyle)) {
    throw (
      'Unsupported Link Style detected in the Obsidian configuration. Please choose one of: ' + supportedLinkFormates
    );
  }
  return foundReadStyle;
}
