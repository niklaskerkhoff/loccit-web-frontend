import { Badge, Box, Button, Flex, IconButton, NativeSelect, Spinner, Text } from '@chakra-ui/react'
import { Fragment, useState } from 'react'
import { LuChevronDown, LuChevronUp, LuRefreshCw, LuStar, LuTriangleAlert } from 'react-icons/lu'
import type { Passage, Source } from '../api'
import { VERDICTS, checkErrorLabel, runSummary, shortLabel, thinkingLabel } from '../labels'
import { type Ordered, readingPosition } from '../passages'
import type { CheckController } from '../useCheck'

// Model and thinking level for the next check, and the button that starts it.
export function CheckControls({ check }: { check: CheckController }) {
  if (!check.models || !check.model) return null
  return (
    <Flex align='center' gap={2} ml='auto'>
      <NativeSelect.Root size='xs' width='auto'>
        <NativeSelect.Field
          aria-label='Modell'
          title='Modell'
          value={check.model.id}
          onChange={event => check.selectModel(event.target.value)}
        >
          {check.models.models.map(model => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <NativeSelect.Root size='xs' width='auto'>
        <NativeSelect.Field
          aria-label='Nachdenken'
          title='Nachdenken'
          value={check.thinking}
          onChange={event => check.selectThinking(event.target.value)}
        >
          {check.model.levels.map(level => (
            <option key={level} value={level}>
              Nachdenken: {thinkingLabel(level)}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Button
        size='xs'
        variant='outline'
        loading={check.busy === 'running'}
        disabled={check.busy !== null}
        title='Prüft mit dem gewählten Modell neu; frühere Ergebnisse bleiben gespeichert'
        onClick={check.recheck}
      >
        <LuRefreshCw /> Neu prüfen
      </Button>
    </Flex>
  )
}

type Props = {
  check: CheckController
  sources: Record<string, Source>
  // Rank of the passage shown: its index in the run's passages, which are
  // stored strongest first. Rank 0 is the strongest passage.
  passage: number | null
  // The run's passages in reading order.
  order: Ordered[]
  onPassage: (rank: number) => void
  // Moves `delta` passages on in reading order.
  onStep: (delta: number) => void
}

// Verdict, the current passage with its reason, and how the result came about.
export function CheckBar({ check, sources, passage, order, onPassage, onStep }: Props) {
  const [showContext, setShowContext] = useState(false)
  const result = check.check
  const run = result?.run ?? null
  const passages = run?.passages ?? []
  const current: Passage | undefined = passage === null ? undefined : passages[passage]
  const position = readingPosition(order, passage)

  return (
    <Box px={3} py={2} borderBottomWidth='1px' flexShrink={0} bg='bg.subtle'>
      {check.busy && (
        <Flex align='center' gap={2} color='fg.muted' fontSize='sm'>
          <Spinner size='xs' />
          {check.busy === 'running'
            ? 'Belegstellen werden gesucht …'
            : 'Gespeichertes Ergebnis wird geladen …'}
        </Flex>
      )}
      {!check.busy && check.failure && <Text color='fg.error'>{check.failure}</Text>}
      {!check.busy && result?.error && (
        <Text fontSize='sm' color={result.error.code === 'no_papers' ? 'fg.muted' : 'fg.error'}>
          {checkErrorLabel(result.error)}
        </Text>
      )}
      {!check.busy && result && !result.error && !run && (
        <Flex align='center' gap={3} fontSize='sm'>
          <Text color='fg.muted'>
            {check.models?.has_api_key
              ? 'Mit diesem Modell und dieser Nachdenk-Stufe wurde noch nicht geprüft.'
              : checkErrorLabel({ code: 'no_api_key', detail: '' })}
          </Text>
          {check.models?.has_api_key && (
            <Button size='xs' colorPalette='blue' onClick={check.recheck}>
              Jetzt prüfen
            </Button>
          )}
        </Flex>
      )}

      {!check.busy && run && (
        <>
          <Flex align='center' gap={2} wrap='wrap'>
            <Badge size='md' colorPalette={VERDICTS[run.verdict].color} variant='solid'>
              {VERDICTS[run.verdict].label}
            </Badge>
            {passages.length > 0 && (
              <Flex align='center'>
                <IconButton
                  aria-label='Vorherige Stelle'
                  title='Vorherige Stelle (K oder Alt+↑)'
                  size='xs'
                  variant='ghost'
                  onClick={() => onStep(-1)}
                >
                  <LuChevronUp />
                </IconButton>
                <IconButton
                  aria-label='Nächste Stelle'
                  title='Nächste Stelle (J oder Alt+↓)'
                  size='xs'
                  variant='ghost'
                  onClick={() => onStep(1)}
                >
                  <LuChevronDown />
                </IconButton>
                <Text fontSize='sm' fontWeight='medium' ml={1}>
                  {current && position
                    ? `Stelle ${position} von ${passages.length} · ${shortLabel(current.cite_key, sources[current.cite_key])}, S. ${current.page + 1}`
                    : `${passages.length} ${passages.length === 1 ? 'Stelle' : 'Stellen'}`}
                </Text>
                {passages.length > 1 && (
                  <Button
                    size='2xs'
                    ml={2}
                    variant={passage === 0 ? 'subtle' : 'outline'}
                    colorPalette='orange'
                    title={
                      passage === 0
                        ? 'Das ist die stärkste Stelle'
                        : 'Zur stärksten Stelle springen (S)'
                    }
                    onClick={() => onPassage(0)}
                  >
                    <LuStar fill={passage === 0 ? 'currentColor' : 'none'} />
                    {passage === 0 ? 'stärkste Stelle' : `stärkste: ${readingPosition(order, 0)}`}
                  </Button>
                )}
              </Flex>
            )}
            {result!.missing_keys.length > 0 && (
              <Badge colorPalette='orange' title='Für diese Quellen lag kein lesbares Paper vor.'>
                <LuTriangleAlert /> Urteil beruht nur auf den vorhandenen Papern (ohne:{' '}
                {result!.missing_keys.map(key => shortLabel(key, sources[key])).join(', ')})
              </Badge>
            )}
          </Flex>
          {current && <Text mt={1}>{current.reason}</Text>}
          {run.verdict === 'not_found' && (
            <Text mt={1} fontSize='sm'>
              Das Modell hat in{' '}
              {result!.checked_keys.length === 1 ? 'diesem Paper' : 'diesen Papern'} keine Stelle
              gefunden, die die Aussage belegt.
            </Text>
          )}
          <Text mt={1} fontSize='xs' color='fg.muted'>
            {runSummary(
              run,
              check.models?.models.find(model => model.id === run.model)?.label ?? run.model,
            )}
            {' · '}
            <Button
              size='2xs'
              variant='plain'
              px={0}
              textDecoration='underline'
              onClick={() => setShowContext(!showContext)}
            >
              {showContext ? 'Geprüften Text ausblenden' : 'Geprüften Text anzeigen'}
            </Button>
          </Text>
        </>
      )}
      {showContext && result?.context && run && <CheckedText text={result.context} />}
    </Box>
  )
}

// The paragraph of the thesis exactly as it was sent, the citation marked.
function CheckedText({ text }: { text: string }) {
  const parts = text.split(/<\/?cite_here>/)
  return (
    <Box mt={2} p={2} bg='bg' borderWidth='1px' borderRadius='sm' fontSize='sm'>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index % 2 === 1 ? (
            <Text as='mark' bg='yellow.200' px={0.5}>
              {part}
            </Text>
          ) : (
            part
          )}
        </Fragment>
      ))}
    </Box>
  )
}
