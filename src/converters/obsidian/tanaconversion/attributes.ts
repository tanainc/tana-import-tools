import { TanaIntermediateAttribute } from '../../../types/types';

export function addAttribute(name: string, attributes: TanaIntermediateAttribute[]) {
  const foundAttr = attributes.filter((attr) => attr.name === name)[0];
  if (foundAttr) {
    foundAttr.count++;
  } else {
    attributes.push({ name, values: [], count: 1 });
  }
}
