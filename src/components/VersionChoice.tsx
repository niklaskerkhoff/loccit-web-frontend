import { Badge, Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import type { Source } from '../api'
import { authorsLabel, itemTypeLabel } from '../labels'

type Props = {
  source: Source
  onPick: (itemKey: string) => Promise<void>
}

// Several Zotero entries fit the cite key and they are different versions of
// the publication. loccit does not guess; the user picks one and the pick is
// remembered.
export function VersionChoice({ source, onPick }: Props) {
  const [picking, setPicking] = useState<string | null>(null)

  const pick = async (itemKey: string) => {
    setPicking(itemKey)
    try {
      await onPick(itemKey)
    } finally {
      setPicking(null)
    }
  }

  return (
    <Box height='100%' overflowY='auto' bg='purple.50' p={8}>
      <Box maxWidth='40em' mx='auto'>
        <Heading size='xl' color='purple.800'>
          Auswahl nötig
        </Heading>
        <Text mt={2}>
          Zu diesem Schlüssel gibt es in Zotero {source.candidates.length} unterscheidbare
          Fassungen. Welche zitierst du? Die Wahl wird gespeichert.
        </Text>
        <Stack mt={5} gap={3}>
          {source.candidates.map(candidate => (
            <Box key={candidate.item_key} p={4} bg='bg' borderWidth='1px' borderRadius='md'>
              <Flex gap={2} align='center' wrap='wrap'>
                <Badge colorPalette='purple'>{itemTypeLabel(candidate.item_type)}</Badge>
                <Text fontSize='sm'>{candidate.date || 'ohne Datum'}</Text>
                <Badge colorPalette={candidate.pdf_count ? 'green' : 'orange'}>
                  {candidate.pdf_count ? `${candidate.pdf_count} PDF` : 'kein PDF'}
                </Badge>
                {candidate.duplicates.length > 1 && (
                  <Badge colorPalette='yellow' title={candidate.duplicates.join(', ')}>
                    Dublette: {candidate.duplicates.length} Einträge
                  </Badge>
                )}
                {source.item_key === candidate.item_key && (
                  <Badge colorPalette='blue'>gewählt</Badge>
                )}
              </Flex>
              <Text mt={2} fontWeight='medium'>
                {candidate.title}
              </Text>
              <Text fontSize='sm' color='fg.muted'>
                {authorsLabel(candidate.authors)}
              </Text>
              <Text fontSize='sm' mt={1} wordBreak='break-all'>
                {candidate.doi ? `DOI ${candidate.doi}` : (candidate.url ?? 'ohne DOI und URL')}
              </Text>
              <Flex mt={3} align='center' justify='space-between'>
                <Text fontFamily='mono' fontSize='xs' color='fg.muted'>
                  {candidate.item_key}
                </Text>
                <Button
                  size='sm'
                  colorPalette='purple'
                  loading={picking === candidate.item_key}
                  disabled={picking !== null}
                  onClick={() => pick(candidate.item_key)}
                >
                  Diese Fassung verwenden
                </Button>
              </Flex>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
