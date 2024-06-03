import { expect, test } from 'vitest';
import { opml2js } from '../opml2js.js';

test('note support ', async () => {
  const opml = `
  <?xml version="1.0"?>
  <opml version="2.0">
    <head>
      <ownerEmail>
        hello@tana.inc
      </ownerEmail>
    </head>
    <body>
      <outline text="Hello" _note="Some note here"/>
    </body>
  </opml>`;

  expect(opml2js(opml)).toEqual({
    opml: {
      head: {
        title: '',
        ownerEmail: 'hello@tana.inc',
      },
      body: {
        subs: [{ text: 'Hello', note:'Some note here' }],
      },
    },
  });
});


test('one level ', async () => {
  const opml = `
  <?xml version="1.0"?>
  <opml version="2.0">
    <head>
      <ownerEmail>
        hello@tana.inc
      </ownerEmail>
    </head>
    <body>
      <outline text="Hello"/>
      <outline text="World"/>
      <outline text="TODO" _complete="true"/>
    </body>
  </opml>`;

  expect(opml2js(opml)).toEqual({
    opml: {
      head: {
        title: '',
        ownerEmail: 'hello@tana.inc',
      },
      body: {
        subs: [{ text: 'Hello' }, { text: 'World' }, { text: 'TODO', _complete: true }],
      },
    },
  });
});

test('XX two levels ', async () => {
  const opml = `
    <?xml version="1.0"?>
    <opml version="2.0">
      <head>
        <ownerEmail>
          hello@tana.inc
        </ownerEmail>
      </head>
      <body>
        <outline text="Hello">
            <outline text="World"/>
        </outline>
      </body>
    </opml>`;

  expect(opml2js(opml)).toEqual({
    opml: {
      head: {
        title: '',
        ownerEmail: 'hello@tana.inc',
      },
      body: {
        subs: [{ text: 'Hello', subs: [{ text: 'World' }] }],
      },
    },
  });
});

test('four levels ', async () => {
  const opml = `
<?xml version="1.0"?>
<opml version="2.0">
  <head>
    <ownerEmail>
      hello@tana.inc
    </ownerEmail>
  </head>
  <body>
    <outline text="First">
      <outline text="Second">
        <outline text="Third">'
          <outline _complete="true" text="Fourth" />
      </outline>
    </outline>
  </body>
</opml>`;

  expect(opml2js(opml)).toEqual({
    opml: {
      head: {
        title: '',
        ownerEmail: 'hello@tana.inc',
      },
      body: {
        subs: [
          {
            text: 'First',
            subs: [
              {
                text: 'Second',
                subs: [
                  {
                    text: 'Third',
                    subs: [
                      {
                        text: 'Fourth',
                        _complete: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });
});

test('two levels ', async () => {
  const opml = `
      <?xml version="1.0"?>
      <opml version="2.0">
        <head>
          <ownerEmail>
            hello@tana.inc
          </ownerEmail>
        </head>
        <body>
        
          <outline text="Hello">
            <outline text="Foo">
                <outline text="1"/>
                <outline text="2"/>
            </outline>
            <outline text="World"/>
          </outline>
        </body>
      </opml>`;

  expect(opml2js(opml)).toEqual({
    opml: {
      head: {
        title: '',
        ownerEmail: 'hello@tana.inc',
      },
      body: {
        subs: [
          {
            text: 'Hello',
            subs: [
              {
                text: 'Foo',
                subs: [
                  {
                    text: '1',
                  },
                  {
                    text: '2',
                  },
                ],
              },
              {
                text: 'World',
              },
            ],
          },
        ],
      },
    },
  });
});
