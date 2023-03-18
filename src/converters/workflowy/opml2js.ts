// copilot
function html_entity_decode(message: string) {
  const entities = [
    ['amp', '&'],
    ['apos', "'"],
    ['lt', '<'],
    ['gt', '>'],
    ['quot', '"'],
  ];

  for (let i = 0, max = entities.length; i < max; ++i) {
    message = message.replace(new RegExp('&' + entities[i][0] + ';', 'g'), entities[i][1]);
  }

  return message;
}

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

// convert OMPL to js
export function opml2js(opmlString: string): TheOutline {
  // run up to the opml-tag
  for (let i = 0; i < opmlString.length; i++) {
    if (opmlString[i] === '<' && opmlString.substring(i, i + 5) === '<opml') {
      opmlString = opmlString.substring(i + 5).substring(0, opmlString.length - '</opml>'.length);
      break;
    }
  }

  // read head part
  const headPart = opmlString.substring(0, opmlString.indexOf('<body>'));
  const ownerEmail = headPart
    .substring(headPart.indexOf('<ownerEmail>') + '<ownerEmail>'.length, headPart.indexOf('</ownerEmail>'))
    .trim();

  // find body part
  const bodyPart = opmlString
    .substring(opmlString.indexOf('<body>') + '<body>'.length)
    .substring(0, opmlString.length - '</body>'.length);

  // read all outline tags
  const items: Sub[] = [];

  // walk through file
  const prevItems: Sub[] = [];
  for (let i = 0; i < bodyPart.length; i++) {
    // we only want to process tags
    if (bodyPart[i] !== '<') {
      continue;
    }

    // if we are at the end of a tag, pop it off the stack of previous items
    if (bodyPart.substring(i, i + '</outline>'.length) === '</outline>') {
      // jump to the end of the tag
      i += '</outline>'.length;
      prevItems.pop();
      continue;
    }
    // a new outline tag was found
    else if (bodyPart.substring(i, i + '<outline'.length) === '<outline') {
      const startOfOutlineTag = i;
      // find end of sub
      let endOfOutlineTag = i;
      while (bodyPart[endOfOutlineTag] !== '>') {
        endOfOutlineTag += 1;
      }

      // Get closing >
      endOfOutlineTag += 1;

      const outlineTagAsString = bodyPart.substring(startOfOutlineTag, endOfOutlineTag);

      // If this is a self closing tag we are a leaf node
      const isLeaf = bodyPart[endOfOutlineTag - 2] === '/';

      const text = getAttribute(outlineTagAsString, 'text');
      const description = getAttribute(outlineTagAsString, '_note');
      const complete = !!getAttribute(outlineTagAsString, '_complete');

      // jump cursor to end of tag
      i += '<outline'.length;

      const item: Sub = {
        text: html_entity_decode(text),
      };
      if (description){
        item.note = description
      }

      if (complete) {
        item['_complete'] = true;
      }

      // check if we have a parent node, and add us to that
      if (prevItems.length) {
        const parent = prevItems[prevItems.length - 1];
        (parent.subs = parent.subs || []).push(item);
      } else {
        // we did not have a parent, add to root level items instead
        items.push(item);
      }

      // if this is not a leaf node we add it as a parent, will will have children
      if (!isLeaf) {
        prevItems.push(item);
      }
    }
  }

  return {
    opml: {
      head: {
        title: '',
        ownerEmail: ownerEmail,
      },
      body: {
        subs: items,
      },
    },
  };
}

// name="foo", _complete="true" etc
function getAttribute(str: string, attrName: string): string {
  const start = str.indexOf(attrName + '="');
  if (start === -1) {
    return '';
  }
  const end = str.indexOf('"', start + attrName.length + 2);
  return str.substring(start + attrName.length + 2, end);
}
