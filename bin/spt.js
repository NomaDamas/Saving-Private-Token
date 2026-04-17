#!/usr/bin/env node
import { main } from '../src/cli.mjs';
main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`spt: ${err?.stack || err?.message || err}\n`);
  process.exit(1);
});
