import { Box, Button, Flex, Heading, Text } from '@chakra-ui/react'
import { LuFileX, LuRefreshCw } from 'react-icons/lu'
import type { Source } from '../api'
import { missingHint, missingReason } from '../labels'

type Props = {
  source: Source
  reloading: boolean
  onReload: () => void
}

// Shown instead of the viewer when there is no PDF for a source. This is an
// expected case, not an error, and no verdict about the citation.
export function PaperNotFound({ source, reloading, onReload }: Props) {
  const known: [string, string | null][] = [
    ['Schlüssel', source.cite_key],
    ['Titel', source.title],
    ['Autoren', source.authors.join(', ') || null],
    ['Jahr', source.year],
    ['Zotero-Eintrag', source.item_key],
  ]
  return (
    <Flex height='100%' overflowY='auto' justify='center' bg='orange.50' p={8}>
      <Box maxWidth='34em' width='100%' my='auto'>
        <Flex align='center' gap={3} color='orange.700'>
          <LuFileX size={28} />
          <Heading size='xl'>Paper nicht gefunden</Heading>
        </Flex>
        <Text mt={3} fontWeight='medium'>
          {missingReason(source)}
        </Text>
        <Box mt={5} p={4} bg='bg' borderWidth='1px' borderRadius='md'>
          {known
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Flex key={label} gap={3} py={1} fontSize='sm'>
                <Text width='8em' flexShrink={0} color='fg.muted'>
                  {label}
                </Text>
                <Text wordBreak='break-word'>{value}</Text>
              </Flex>
            ))}
        </Box>
        <Text mt={4} fontSize='sm' color='fg.muted'>
          {missingHint(source)}
        </Text>
        <Button mt={4} size='sm' variant='outline' loading={reloading} onClick={onReload}>
          <LuRefreshCw /> Zuordnung neu einlesen
        </Button>
      </Box>
    </Flex>
  )
}
