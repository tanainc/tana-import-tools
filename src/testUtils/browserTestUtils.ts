import { TanaIntermediateFile, TanaIntermediateNode } from '../types/types.js';
import { IConverter } from '../converters/IConverter.js';
import { MarkdownConverter, type FileSystem, type PathIsh } from '../converters/markdown/index.js';

export const isBrowserEnvironment = typeof window !== 'undefined';

type ConverterLike = Pick<IConverter, 'convert'> | { convert: (content: string) => TanaIntermediateFile | undefined };

export function convertFixture(converter: ConverterLike, rawContent: string): TanaIntermediateFile {
  const result = converter.convert(rawContent);
  if (!result) {
    throw new Error('Converter returned undefined result');
  }
  return result;
}

export function findNodeByName(
  nodes: TanaIntermediateNode[] | undefined,
  name: string,
): TanaIntermediateNode | undefined {
  if (!nodes) {
    return undefined;
  }
  for (const node of nodes) {
    if (node.name === name) {
      return node;
    }
    const match = findNodeByName(node.children, name);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function createBrowserMarkdownConverter(): MarkdownConverter {
  const fileSystem: FileSystem = {
    existsSync: () => false,
    statSync: () =>
      ({
        isDirectory: () => false,
      }) as any,
    readdirSync: () => [] as any,
    readFileSync: () => '',
  };

  const pathIsh: PathIsh = {
    dirname: (value: string) => {
      const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
      const index = trimmed.lastIndexOf('/');
      if (index <= 0) {
        return '.';
      }
      return trimmed.slice(0, index);
    },
    basename: (value: string) => {
      const segments = value.split('/');
      return segments[segments.length - 1] || value;
    },
    resolve: (...parts: string[]) => parts.filter(Boolean).join('/'),
    join: (base: string, addition: string) => {
      const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      return [normalizedBase, addition].filter(Boolean).join('/');
    },
  };

  return new MarkdownConverter(fileSystem, pathIsh);
}
