// Shape & Colour Decoder's lazy entry point (the interactives contract,
// plan.md Step 26 and amendment E33): default-exports the Decoder screen,
// rendered with no props. This file is the chunk src/app/routes.tsx loads
// through the registry entry's load(), and the manifest key
// scripts/check-interactive-size.mjs charges to the shape-colour-decoder
// size budget. The import names Decoder.tsx with its extension: on a
// case-insensitive file system an extensionless './Decoder' would first
// match the pure module decoder.ts beside it.
// Depends on: ./Decoder.tsx.
// Depended on by: src/features/interactives/registry.ts (load: dynamic
// import), scripts/check-interactive-size.mjs (manifest key, read as text).

import Decoder from './Decoder.tsx';

export default Decoder;
