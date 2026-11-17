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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import {
  type Document,
  type DocumentCitations,
  documentPdfUrl,
  getCitations,
  listDocuments,
} from '../api'
import { PaperPane } from '../components/PaperPane'
import { zoteroProblem } from '../labels'
import { PdfViewer } from '../pdf/PdfViewer'
import { openStartPage } from '../routing'

// The citation shown on the right: a group and one citation in it.
type Active = { groupId: number; index: number }

export function DocumentPage({ documentId }: { documentId: number }) {
  const [document, setDocument] = useState<Document | null>(null)
  const [data, setData] = useState<DocumentCitations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Active | null>(null)

  // `reload` reads the Zotero library again, e.g. after a PDF was added there.
  const load = async (reload: boolean) => {
    setLoading(true)
    try {
      setData(await getCitations(documentId, reload))
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

  // Link annotation ("<page>:<annotation id>") -> the citation it belongs to.
  const citationLinks = useMemo(() => {
    const links = new Map<string, Active>()
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
    (annotationId: string, pageIndex: number) => {
      const citation = citationLinks.get(`${pageIndex}:${annotationId}`)
      if (!citation) return false
      setActive(citation)
      return true
    },
    [citationLinks],
  )

  const group = active ? data?.groups[active.groupId] : undefined
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
            <PdfViewer url={documentPdfUrl(document)} onLinkClick={onLinkClick} />
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
                  reloading={loading}
                  onSelect={index => setActive({ groupId: group.id, index })}
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
