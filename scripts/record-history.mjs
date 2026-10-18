import {makeCatalog} from './catalog.mjs';
// Only appends identities: all previously published entries are validated before writing.
console.log(JSON.stringify(await makeCatalog({recordHistory: true})));
