// Copies the files PDF.js loads at runtime (character maps, standard fonts,
// decoders) from node_modules into public/pdfjs, from where Vite serves them.
import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules', 'pdfjs-dist')
const target = join(root, 'public', 'pdfjs')

rmSync(target, { recursive: true, force: true })
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(join(source, folder), join(target, folder), { recursive: true })
}
