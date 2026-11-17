import { Badge, Box, Button, Flex, IconButton, NativeSelect, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuCircleHelp, LuTriangleAlert } from 'react-icons/lu'
import { type CitationGroup, type Source, chooseItem, choosePdf, paperPdfUrl } from '../api'
import { authorsLabel, shortLabel } from '../labels'
import { type Focus, type Highlight, PdfViewer } from '../pdf/PdfViewer'
import type { CheckController } from '../useCheck'
import { CheckBar, CheckControls } from './CheckBar'
import { PaperNotFound } from './PaperNotFound'
import { VersionChoice } from './VersionChoice'

type Props = {
  group: CitationGroup
  sources: Record<string, Source>
  // Which citation of the group is shown.
  index: number
  // Which passage of the check is the current one.
  passage: number | null
  check: CheckController
  reloading: boolean
  onSelect: (index: number) => void
  onPassage: (index: number) => void
  // A choice was stored; the sources have to be fetched again.
  onChanged: () => Promise<void>
  onReload: () => void
}

// The right column: the citations of the clicked group, the result of the
// check, and for the selected citation its paper, the reason why there is
// none, or the versions to choose from.
export function PaperPane(props: Props) {
  const { group, sources, index, passage, check, onSelect, onPassage } = props
  const count = group.citations.length
  const citation = group.citations[Math.min(index, count - 1)]
  const source = sources[citation.key]
  const run = check.busy ? null : (check.check?.run ?? null)
  const passageCount = run?.passages.length ?? 0

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.metaKey || event.ctrlKey) return
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      const key = event.key.toLowerCase()
      const next = key === 'j' || (event.altKey && key === 'arrowdown')
      const previous = key === 'k' || (event.altKey && key === 'arrowup')
      if (passageCount > 0 && (next || previous)) {
        onPassage(((passage ?? -1) + (next ? 1 : -1) + passageCount) % passageCount)
      } else if (count > 1 && !event.altKey && key === 'arrowleft') {
        onSelect((index + count - 1) % count)
      } else if (count > 1 && !event.altKey && key === 'arrowright') {
        onSelect((index + 1) % count)
      } else {
        return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [count, index, passage, passageCount, onSelect, onPassage])

  // All passages in the shown paper are marked, the current one strongly.
  const highlights = useMemo<Highlight[]>(
    () =>
      (run?.passages ?? []).flatMap((item, position) =>
        item.cite_key === citation.key
          ? item.rects.map(({ page, rect }) => ({ page, rect, active: position === passage }))
          : [],
      ),
    [run, citation.key, passage],
  )
  const current = passage === null ? undefined : run?.passages[passage]
  const focus: Focus | null =
    run && current && current.cite_key === citation.key
      ? { ...current.rects[0], key: `${run.id}:${passage}` }
      : null

  return (
    <Flex direction='column' height='100%' minWidth={0}>
      <Flex align='center' gap={2} px={3} py={2} borderBottomWidth='1px' wrap='wrap' flexShrink={0}>
        <Text fontSize='sm' color='fg.muted' whiteSpace='nowrap'>
          {count > 1 ? `Zitatgruppe mit ${count} Quellen` : 'Quelle'} · S. {group.page + 1}
        </Text>
        {group.citations.map((item, position) => (
          <CitationChip
            key={item.key}
            label={shortLabel(item.key, sources[item.key])}
            source={sources[item.key]}
            active={position === index}
            onClick={() => onSelect(position)}
          />
        ))}
        {count > 1 && (
          <Flex align='center'>
            <IconButton
              aria-label='Vorherige Quelle der Gruppe'
              title='Vorherige Quelle (←)'
              size='xs'
              variant='ghost'
              onClick={() => onSelect((index + count - 1) % count)}
            >
              <LuChevronLeft />
            </IconButton>
            <Text fontSize='sm' whiteSpace='nowrap'>
              {index + 1} von {count}
            </Text>
            <IconButton
              aria-label='Nächste Quelle der Gruppe'
              title='Nächste Quelle (→)'
              size='xs'
              variant='ghost'
              onClick={() => onSelect((index + 1) % count)}
            >
              <LuChevronRight />
            </IconButton>
          </Flex>
        )}
        <CheckControls check={check} />
      </Flex>
      <CheckBar check={check} sources={sources} passage={passage} onPassage={onPassage} />
      {source && (
        // The key resets "change version" when another citation is selected.
        <SourceView
          key={citation.key}
          source={source}
          highlights={highlights}
          focus={focus}
          reloading={props.reloading}
          onChanged={props.onChanged}
          onReload={props.onReload}
        />
      )}
    </Flex>
  )
}

function CitationChip(props: {
  label: string
  source: Source | undefined
  active: boolean
  onClick: () => void
}) {
  const status = props.source?.status
  const missing = status === 'no_entry' || status === 'no_pdf' || status === 'file_missing'
  const choice = status === 'choice_needed'
  return (
    <Button
      size='xs'
      variant={props.active ? 'solid' : 'outline'}
      colorPalette={missing ? 'orange' : choice ? 'purple' : 'blue'}
      title={missing ? 'Paper nicht gefunden' : choice ? 'Auswahl nötig' : undefined}
      onClick={props.onClick}
    >
      {missing && <LuTriangleAlert />}
      {choice && <LuCircleHelp />}
      <Text as='span' textDecoration={missing ? 'line-through' : undefined}>
        {props.label}
      </Text>
    </Button>
  )
}

function SourceView(props: {
  source: Source
  highlights: Highlight[]
  focus: Focus | null
  reloading: boolean
  onChanged: () => Promise<void>
  onReload: () => void
}) {
  const { source } = props
  const [changingVersion, setChangingVersion] = useState(false)

  const pickVersion = async (itemKey: string) => {
    await chooseItem(source.cite_key, itemKey)
    await props.onChanged()
    setChangingVersion(false)
  }
  const pickPdf = async (attachmentKey: string) => {
    if (source.item_key) await choosePdf(source.item_key, attachmentKey)
    await props.onChanged()
  }

  const byline = [authorsLabel(source.authors), source.year].filter(Boolean).join(' · ')
  return (
    <>
      <Box px={3} py={2} borderBottomWidth='1px' flexShrink={0}>
        <Text fontWeight='semibold' lineClamp={2}>
          {source.title ?? source.cite_key}
        </Text>
        {source.title && (
          <Text fontSize='sm' color='fg.muted'>
            {byline && `${byline} · `}
            <Text as='span' fontFamily='mono' fontSize='xs'>
              {source.cite_key}
            </Text>
          </Text>
        )}
        <Flex gap={2} mt={1} wrap='wrap' align='center' _empty={{ display: 'none' }}>
          {source.conflict && (
            <Badge
              colorPalette='red'
              title='Weg A (.bib) und Weg B (Schlüssel) finden verschiedene Einträge.'
            >
              <LuTriangleAlert /> Weg A und Weg B widersprechen sich, es gilt Weg A
            </Badge>
          )}
          {source.duplicates.length > 1 && (
            <Badge colorPalette='yellow' title={`Zotero-Einträge: ${source.duplicates.join(', ')}`}>
              Dublette: {source.duplicates.length} Einträge, gewählt {source.item_key}
            </Badge>
          )}
          {source.chosen_by === 'override' && <Badge>manuell zugeordnet (overrides.toml)</Badge>}
          {source.chosen_by === 'choice' && (
            <>
              <Badge colorPalette='purple'>Fassung von dir gewählt</Badge>
              <Button
                size='2xs'
                variant='ghost'
                onClick={() => setChangingVersion(!changingVersion)}
              >
                {changingVersion ? 'Abbrechen' : 'Ändern'}
              </Button>
            </>
          )}
          {source.pdfs.length > 1 && source.attachment_key && (
            <Flex align='center' gap={2}>
              <Badge colorPalette='yellow'>{source.pdfs.length} PDFs am Eintrag</Badge>
              <NativeSelect.Root size='xs' width='auto' maxWidth='22em'>
                <NativeSelect.Field
                  aria-label='PDF des Eintrags'
                  value={source.attachment_key}
                  onChange={event => pickPdf(event.target.value)}
                >
                  {source.pdfs.map(pdf => (
                    <option
                      key={pdf.attachment_key}
                      value={pdf.attachment_key}
                      disabled={!pdf.exists}
                    >
                      {pdf.filename ?? pdf.attachment_key}
                      {pdf.exists ? '' : ' (Datei fehlt)'}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Flex>
          )}
        </Flex>
      </Box>
      <Box flex={1} minHeight={0}>
        {source.status === 'choice_needed' || changingVersion ? (
          <VersionChoice source={source} onPick={pickVersion} />
        ) : source.attachment_key ? (
          <PdfViewer
            url={paperPdfUrl(source.attachment_key)}
            highlights={props.highlights}
            focus={props.focus}
          />
        ) : (
          <PaperNotFound source={source} reloading={props.reloading} onReload={props.onReload} />
        )}
      </Box>
    </>
  )
}
