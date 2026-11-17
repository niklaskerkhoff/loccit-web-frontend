// Sets PDF.js up once. The viewer components read the library from
// `globalThis.pdfjsLib`, so this module must be imported before them.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
;(globalThis as { pdfjsLib?: unknown }).pdfjsLib = pdfjsLib

// Copied to public/pdfjs by scripts/copy-pdfjs-assets.mjs.
const assets = new URL('pdfjs/', document.baseURI).href

export function loadPdf(url: string) {
  return pdfjsLib.getDocument({
    url,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
  })
}

export { pdfjsLib }
