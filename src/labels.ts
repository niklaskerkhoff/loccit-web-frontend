// German wording for what the backend reports as codes.
import type { Candidate, Source, ZoteroState } from './api'

const ITEM_TYPES: Record<string, string> = {
  journalArticle: 'Zeitschriftenartikel',
  conferencePaper: 'Konferenzbeitrag',
  preprint: 'Preprint',
  book: 'Buch',
  bookSection: 'Buchkapitel',
  report: 'Bericht',
  thesis: 'Abschlussarbeit',
  webpage: 'Webseite',
  blogPost: 'Blogbeitrag',
  standard: 'Norm',
  encyclopediaArticle: 'Lexikonartikel',
}

export function itemTypeLabel(itemType: string): string {
  return ITEM_TYPES[itemType] ?? itemType
}

export function authorsLabel(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} und ${authors[1]}`
  return `${authors[0]} et al.`
}

// "Heltweg 2025", or the cite key if nothing is known about the source.
export function shortLabel(citeKey: string, source: Source | undefined): string {
  if (!source || source.authors.length === 0) return citeKey
  return [source.authors[0], source.year].filter(Boolean).join(' ')
}

export function candidateLabel(candidate: Candidate): string {
  return [authorsLabel(candidate.authors), candidate.date].filter(Boolean).join(', ')
}

// Why there is no paper to show. The three reasons are kept apart.
export function missingReason(source: Source): string {
  switch (source.status) {
    case 'no_pdf':
      return `Der Zotero-Eintrag ${source.item_key} ist gefunden, hat aber keinen PDF-Anhang.`
    case 'file_missing':
      return (
        `Der Zotero-Eintrag ${source.item_key} hat einen PDF-Anhang, ` +
        'die Datei fehlt aber auf der Platte.'
      )
    default:
      if (source.detail === 'unknown_override') {
        return 'Die Zuordnung in overrides.toml verweist auf einen Eintrag, den es in Zotero nicht gibt.'
      }
      return 'Zu diesem Schlüssel passt kein Zotero-Eintrag.'
  }
}

export function missingHint(source: Source): string {
  switch (source.status) {
    case 'no_pdf':
      return 'Hänge das PDF in Zotero an diesen Eintrag an und lies die Zuordnung neu ein.'
    case 'file_missing':
      return 'Lass Zotero die Datei erneut herunterladen oder hänge das PDF neu an, dann lies die Zuordnung neu ein.'
    default:
      return 'Füge das Paper zu Zotero hinzu und lies die Zuordnung neu ein.'
  }
}

export function zoteroProblem(zotero: ZoteroState): string {
  switch (zotero.status) {
    case 'not_running':
      return 'Zotero läuft nicht. Starte Zotero und lies die Zuordnung neu ein.'
    case 'api_disabled':
      return (
        'Zotero lehnt den Zugriff ab. Schalte in Zotero unter Einstellungen → Erweitert ' +
        '„Anderen Anwendungen auf diesem Computer die Kommunikation mit Zotero erlauben“ ein.'
      )
    default:
      return `Zotero meldet einen Fehler: ${zotero.detail ?? 'unbekannt'}`
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}
