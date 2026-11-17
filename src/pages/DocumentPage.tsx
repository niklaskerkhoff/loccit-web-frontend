import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Spinner,
  Splitter,
  Text,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import {
  type Check,
  type CitationGroup,
  type Document,
  type DocumentCitations,
  documentPdfUrl,
  getCitations,
  listDocuments,
} from '../api'
import { PaperPane } from '../components/PaperPane'
import { zoteroProblem } from '../labels'
import { type Highlight, PdfViewer } from '../pdf/PdfViewer'
import { openStartPage } from '../routing'
import { useCheck } from '../useCheck'

// What the right column shows: a citation group, one citation in it, and
// the current passage of its check. `token` changes with every click on a
// citation.
type Active = { groupId: number; index: number; passage: number | null; token: number }

function citationIndex(group: CitationGroup, citeKey: string): number {
  return Math.max(
    0,
    group.citations.findIndex(citation => citation.key === citeKey),
  )
}

export function DocumentPage({ documentId }: { documentId: number }) {
  const [document, setDocument] = useState<Document | null>(null)
  const [data, setData] = useState<DocumentCitations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Active | null>(null)
  // Counts how often the sources were read; stored checks are then refetched.
  const [version, setVersion] = useState(0)
  const clicks = useRef(0)

  // `reload` reads the Zotero library again, e.g. after a PDF was added there.
  const load = async (reload: boolean) => {
    setLoading(true)
    try {
      setData(await getCitations(documentId, reload))
      setVersion(version => version + 1)
      setError(null)
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // The thesis is shown right away; resolving its citations takes longer.
    listDocuments().then(
      documents => {
        const found = documents.find(document => document.id === documentId)
        if (found) setDocument(found)
        else setError('Dieses Dokument gibt es nicht mehr.')
      },
      (error: Error) => setError(error.message),
    )
    getCitations(documentId, true)
      .then(setData, (error: Error) => setError(error.message))
      .finally(() => setLoading(false))
  }, [documentId])

  const citationsLoaded = data !== null
  // Link annotation ("<page>:<annotation id>") -> the citation it belongs to.
  const citationLinks = useMemo(() => {
    const links = new Map<string, { groupId: number; index: number }>()
    for (const group of data?.groups ?? []) {
      group.citations.forEach((citation, index) => {
        for (const id of citation.annotation_ids) {
          links.set(`${group.page}:${id}`, { groupId: group.id, index })
        }
      })
    }
    return links
  }, [data])

  const onLinkClick = useCallback(
    (annotationId: string, pageIndex: number, href: string) => {
      const citation = citationLinks.get(`${pageIndex}:${annotationId}`)
      // Until the citations are loaded, a citation link does nothing rather
      // than jump to the bibliography.
      if (!citation) return !citationsLoaded && href.includes('#cite.')
      clicks.current += 1
      setActive({ ...citation, passage: null, token: clicks.current })
      return true
    },
    [citationLinks, citationsLoaded],
  )

  const group = active ? data?.groups[active.groupId] : undefined

  // A result arrived: jump to its strongest passage, in whichever paper.
  const onResult = (check: Check) => {
    const strongest = check.run?.passages[0]
    if (!group || !strongest) return
    setActive(
      active =>
        active && { ...active, passage: 0, index: citationIndex(group, strongest.cite_key) },
    )
  }
  const check = useCheck(
    documentId,
    data?.zotero.status === 'ok' ? (active?.groupId ?? null) : null,
    version,
    active?.token ?? 0,
    onResult,
  )
  const passages = check.check?.run?.passages ?? []

  // Shows a passage by rank (its index in the strongest-first list); the
  // paper follows the passage.
  const showPassage = (passage: number) => {
    if (!group || !passages[passage]) return
    const index = citationIndex(group, passages[passage].cite_key)
    setActive(active => active && { ...active, passage, index })
  }
  // Selecting a citation of the group shows its first passage, if it has one.
  const showCitation = (index: number) => {
    if (!group) return
    const first = passages.findIndex(passage => passage.cite_key === group.citations[index].key)
    setActive(active => active && { ...active, index, passage: first === -1 ? null : first })
  }

  // The clicked citation stays marked in the thesis.
  const thesisHighlights = useMemo<Highlight[]>(
    () =>
      (group?.citations ?? []).flatMap((citation, index) =>
        citation.rects.map(rect => ({ page: group!.page, rect, active: index === active?.index })),
      ),
    [group, active?.index],
  )
  const sources = Object.values(data?.sources ?? {})
  const missing = sources.filter(source =>
    ['no_entry', 'no_pdf', 'file_missing'].includes(source.status),
  ).length
  const choices = sources.filter(source => source.status === 'choice_needed').length

  return (
    <Flex direction='column' height='100%'>
      <Flex align='center' gap={2} px={2} height='44px' flexShrink={0} borderBottomWidth='1px'>
        <IconButton
          aria-label='Zur Startseite'
          title='Zur Startseite'
          size='sm'
          variant='ghost'
          onClick={openStartPage}
        >
          <LuArrowLeft />
        </IconButton>
        <Text fontWeight='medium' truncate>
          {document?.name ?? ''}
        </Text>
        {document && !document.has_bib && <Badge>ohne .bib</Badge>}
        {data && data.zotero.status === 'ok' && (
          <>
            <Badge colorPalette='blue'>
              {data.groups.length} {data.groups.length === 1 ? 'Zitatstelle' : 'Zitatstellen'}
            </Badge>
            {missing > 0 && (
              <Badge colorPalette='orange'>
                {missing} {missing === 1 ? 'Quelle' : 'Quellen'} ohne PDF
              </Badge>
            )}
            {choices > 0 && <Badge colorPalette='purple'>{choices} × Auswahl nötig</Badge>}
          </>
        )}
        <Box flex={1} />
        <Button
          size='sm'
          variant='outline'
          loading={loading}
          title='Liest die Zotero-Bibliothek und die Zuordnung neu ein'
          onClick={() => load(true)}
        >
          <LuRefreshCw /> Zuordnung neu einlesen
        </Button>
      </Flex>

      <Splitter.Root
        flex={1}
        minHeight={0}
        defaultSize={[50, 50]}
        panels={[
          { id: 'thesis', minSize: 20 },
          { id: 'paper', minSize: 20 },
        ]}
      >
        <Splitter.Panel id='thesis'>
          {document ? (
            <PdfViewer
              url={documentPdfUrl(document)}
              highlights={thesisHighlights}
              onLinkClick={onLinkClick}
            />
          ) : (
            !error && <Centered>{<Spinner />}</Centered>
          )}
        </Splitter.Panel>
        <Splitter.ResizeTrigger id='thesis:paper' />
        <Splitter.Panel id='paper'>
          <Flex direction='column' height='100%' minWidth={0}>
            {error && <Notice status='error' title={error} />}
            {data && data.zotero.status !== 'ok' && (
              <Notice status='warning' title={zoteroProblem(data.zotero)} />
            )}
            {data && data.groups.length === 0 && (
              <Notice
                status='warning'
                title='Dieses PDF enthält keine Zitat-Links.'
                description={noCitationLinks(data)}
              />
            )}
            <Box flex={1} minHeight={0}>
              {group && active && data && data.zotero.status === 'ok' ? (
                <PaperPane
                  group={group}
                  sources={data.sources}
                  index={active.index}
                  passage={active.passage}
                  check={check}
                  reloading={loading}
                  onSelect={showCitation}
                  onPassage={showPassage}
                  onChanged={() => load(false)}
                  onReload={() => load(true)}
                />
              ) : (
                <Centered>
                  {loading && !data ? (
                    <Flex gap={3} align='center' color='fg.muted'>
                      <Spinner size='sm' /> Zuordnung der Quellen wird eingelesen …
                    </Flex>
                  ) : (
                    <Text color='fg.muted'>
                      Klicke links auf eine Quellenangabe, um das zitierte Paper zu öffnen.
                    </Text>
                  )}
                </Centered>
              )}
            </Box>
          </Flex>
        </Splitter.Panel>
      </Splitter.Root>
    </Flex>
  )
}

function noCitationLinks(data: DocumentCitations): string {
  const found = Object.entries(data.named_destinations)
    .map(([prefix, count]) => `${prefix}.* (${count})`)
    .join(', ')
  const links = found
    ? `Gefundene benannte Link-Ziele: ${found}.`
    : `Das PDF hat ${data.link_count} Links, keiner mit benanntem Ziel.`
  return `Erwartet werden Link-Ziele der Form cite.<key> oder cite.<refsection>@<key>, wie hyperref sie erzeugt. ${links}`
}

function Notice(props: { status: 'error' | 'warning'; title: string; description?: string }) {
  return (
    <Alert.Root status={props.status} borderRadius={0} flexShrink={0}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{props.title}</Alert.Title>
        {props.description && <Alert.Description>{props.description}</Alert.Description>}
      </Alert.Content>
    </Alert.Root>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Flex height='100%' align='center' justify='center' p={8} textAlign='center'>
      {children}
    </Flex>
  )
}
