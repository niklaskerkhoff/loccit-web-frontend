// Hash routes: `#/` is the start page, `#/doc/<id>` a document. Hash routing
// needs no server support and also works from a file:// URL.
import { useSyncExternalStore } from 'react'

export type Route = { page: 'start' } | { page: 'document'; id: number }

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function parseRoute(hash: string): Route {
  const match = /^#\/doc\/(\d+)$/.exec(hash)
  return match ? { page: 'document', id: Number(match[1]) } : { page: 'start' }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}

export function openDocument(id: number): void {
  window.location.hash = `#/doc/${id}`
}

export function openStartPage(): void {
  window.location.hash = '#/'
}
