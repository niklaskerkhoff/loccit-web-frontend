// German wording for what the backend reports as codes.
import type { Candidate, Run, Source, Verdict, ZoteroState } from './api'

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

// --- checks ------------------------------------------------------------------

const THINKING_LEVELS: Record<string, string> = {
  off: 'aus',
  low: 'niedrig',
  medium: 'mittel',
  high: 'hoch',
  xhigh: 'sehr hoch',
  max: 'maximal',
}

export function thinkingLabel(level: string): string {
  return THINKING_LEVELS[level] ?? level
}

export const VERDICTS: Record<Verdict, { label: string; color: string }> = {
  supported: { label: 'Belegt', color: 'green' },
  partially_supported: { label: 'Teilweise belegt', color: 'yellow' },
  not_found: { label: 'Keine Belegstelle gefunden', color: 'red' },
}

const CHECK_ERRORS: Record<string, string> = {
  no_api_key:
    'Es ist kein Anthropic-API-Key hinterlegt. Setze ANTHROPIC_API_KEY oder führe `python -m loccit set-key` aus und starte loccit neu.',
  invalid_api_key:
    'Der Anthropic-API-Key wurde abgelehnt. Prüfe ihn mit `python -m loccit set-key`.',
  permission_denied: 'Der API-Key darf dieses Modell nicht verwenden.',
  no_papers: 'Für diese Quellenangabe liegt kein Paper vor, deshalb wurde nichts geprüft.',
  no_context: 'Der Absatz um diese Quellenangabe konnte nicht gelesen werden.',
  zotero_unavailable: 'Zotero ist nicht erreichbar.',
  unknown_model: 'Dieses Modell kennt die API nicht. Prüfe ~/.loccit/models.toml.',
  unsupported_thinking: 'Dieses Modell unterstützt die gewählte Nachdenk-Stufe nicht.',
  rate_limited: 'Die API meldet ein Rate-Limit. Versuche es gleich noch einmal.',
  refused: 'Das Modell hat die Anfrage abgelehnt.',
  truncated: 'Die Antwort des Modells wurde abgeschnitten. Wähle eine niedrigere Nachdenk-Stufe.',
  bad_response: 'Die Antwort des Modells hatte nicht das erwartete Format.',
  api_error: 'Die API meldet einen Fehler.',
  no_connection: 'Keine Verbindung zur Claude-API.',
}

export function checkErrorLabel(error: { code: string; detail: string }): string {
  const text = CHECK_ERRORS[error.code] ?? `Prüfung fehlgeschlagen (${error.code}).`
  const showDetail = ['api_error', 'permission_denied', 'refused', 'bad_response'].includes(
    error.code,
  )
  return showDetail && error.detail ? `${text} ${error.detail}` : text
}

function formatNumber(value: number): string {
  return value.toLocaleString('de-DE')
}

// "Sonnet 5.5 · Nachdenken aus · 4,2 s · 18.432 → 150 Token · ≈ 0,045 $"
export function runSummary(run: Run, modelLabel: string): string {
  const seconds = (run.duration_ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  const input = run.input_tokens + run.cache_read_tokens + run.cache_write_tokens
  const cost = run.cost_usd.toLocaleString('de-DE', {
    minimumFractionDigits: 3,
    maximumFractionDigits: run.cost_usd < 0.01 ? 4 : 3,
  })
  const cached = run.cache_read_tokens
    ? ` (${formatNumber(run.cache_read_tokens)} aus dem Cache)`
    : ''
  return [
    modelLabel,
    `Nachdenken ${thinkingLabel(run.thinking)}`,
    `${seconds} s`,
    `${formatNumber(input)} Eingabe-Token${cached}, ${formatNumber(run.output_tokens)} Ausgabe-Token`,
    `≈ ${cost} $`,
    formatDate(run.started_at),
  ].join(' · ')
}
