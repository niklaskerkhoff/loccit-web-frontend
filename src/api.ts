// Client for the loccit backend. The types mirror its OpenAPI schema
// (/api/openapi.json); everything the frontend knows comes through here.

// Empty in the browser (same origin or Vite proxy); a shell such as Electron
// can point it at the backend with VITE_API_BASE.
const API_BASE: string = import.meta.env.VITE_API_BASE ?? ''

export type Document = {
  id: number
  name: string
  has_bib: boolean
  version: string
  uploaded_at: string
  opened_at: string
}

export type Citation = {
  key: string
  rects: [number, number, number, number][]
  annotation_ids: string[]
}

export type CitationGroup = {
  id: number
  page: number
  citations: Citation[]
}

export type PdfFile = {
  attachment_key: string
  filename: string | null
  exists: boolean
}

export type Candidate = {
  item_key: string
  item_type: string
  title: string
  authors: string[]
  date: string
  doi: string | null
  url: string | null
  pdf_count: number
  duplicates: string[]
}

export type Way = {
  status: 'match' | 'choice' | 'none' | 'skipped'
  how: string
  item_key: string | null
  candidates: string[]
}

export type SourceStatus = 'ok' | 'choice_needed' | 'no_entry' | 'no_pdf' | 'file_missing'

export type Source = {
  cite_key: string
  status: SourceStatus
  detail: string
  item_key: string | null
  chosen_by: 'override' | 'choice' | 'a' | 'b' | null
  conflict: boolean
  duplicates: string[]
  candidates: Candidate[]
  pdfs: PdfFile[]
  attachment_key: string | null
  title: string | null
  authors: string[]
  year: string | null
  way_a: Way
  way_b: Way
}

export type ZoteroState = {
  status: 'ok' | 'not_running' | 'api_disabled' | 'error'
  detail: string | null
}

export type DocumentCitations = {
  document: Document
  zotero: ZoteroState
  groups: CitationGroup[]
  sources: Record<string, Source>
  link_count: number
  named_destinations: Record<string, number>
  suspected_ranges: number
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_BASE + path, init)
  } catch {
    throw new ApiError(0, 'Das loccit-Backend ist nicht erreichbar. Läuft `python -m loccit`?')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : response.statusText
    throw new ApiError(response.status, detail)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

function putJson(path: string, body: unknown): Promise<void> {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function listDocuments(): Promise<Document[]> {
  return request('/api/documents')
}

export function uploadDocument(pdf: File, bib: File | null): Promise<Document> {
  const form = new FormData()
  form.append('pdf', pdf)
  if (bib) form.append('bib', bib)
  return request('/api/documents', { method: 'POST', body: form })
}

export function deleteDocument(id: number): Promise<void> {
  return request(`/api/documents/${id}`, { method: 'DELETE' })
}

export function getCitations(id: number, reload: boolean): Promise<DocumentCitations> {
  return request(`/api/documents/${id}/citations?reload=${reload}`)
}

export function chooseItem(citeKey: string, itemKey: string | null): Promise<void> {
  return putJson(`/api/choices/items/${encodeURIComponent(citeKey)}`, { item_key: itemKey })
}

export function choosePdf(itemKey: string, attachmentKey: string | null): Promise<void> {
  return putJson(`/api/choices/pdfs/${encodeURIComponent(itemKey)}`, {
    attachment_key: attachmentKey,
  })
}

export function documentPdfUrl(document: Document): string {
  return `${API_BASE}/api/documents/${document.id}/pdf?v=${document.version}`
}

export function paperPdfUrl(attachmentKey: string): string {
  return `${API_BASE}/api/papers/${encodeURIComponent(attachmentKey)}/pdf`
}
