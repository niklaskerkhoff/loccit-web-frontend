import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  IconButton,
  Stack,
  Text,
} from '@chakra-ui/react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { LuFileText, LuTrash2, LuUpload } from 'react-icons/lu'
import { type Document, deleteDocument, listDocuments, uploadDocument } from '../api'
import { formatDate } from '../labels'
import { openDocument } from '../routing'

function hasExtension(file: File, extension: string): boolean {
  return file.name.toLowerCase().endsWith(extension)
}

export function StartPage() {
  const [documents, setDocuments] = useState<Document[] | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [bib, setBib] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listDocuments().then(setDocuments, (error: Error) => setError(error.message))
  }, [])

  const addFiles = (files: FileList | null) => {
    for (const file of files ?? []) {
      if (hasExtension(file, '.pdf')) setPdf(file)
      else if (hasExtension(file, '.bib')) setBib(file)
      else setError(`„${file.name}“ ist weder ein PDF noch eine .bib-Datei.`)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    setError(null)
    addFiles(event.dataTransfer.files)
  }

  const upload = async () => {
    if (!pdf) return
    setUploading(true)
    setError(null)
    try {
      const document = await uploadDocument(pdf, bib)
      openDocument(document.id)
    } catch (error) {
      const message = (error as Error).message
      setError(message === 'not a readable PDF' ? `„${pdf.name}“ ist kein lesbares PDF.` : message)
      setUploading(false)
    }
  }

  const remove = async (document: Document) => {
    if (!window.confirm(`„${document.name}“ aus loccit entfernen?`)) return
    await deleteDocument(document.id)
    setDocuments(await listDocuments())
  }

  return (
    <Box height='100%' overflowY='auto' bg='bg.subtle'>
      <Container maxWidth='3xl' py={12}>
        <Heading size='3xl'>loccit</Heading>
        <Text color='fg.muted' mb={8}>
          Quellenangaben einer Arbeit am Originalpaper nachprüfen.
        </Text>

        <Box
          borderWidth='2px'
          borderStyle='dashed'
          borderColor={dragging ? 'blue.500' : 'border.emphasized'}
          bg={dragging ? 'blue.50' : 'bg'}
          borderRadius='lg'
          p={8}
          textAlign='center'
          onDragOver={event => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Text fontWeight='medium'>PDF der Arbeit und .bib-Datei hierher ziehen</Text>
          <Text color='fg.muted' fontSize='sm' mb={4}>
            Die .bib ist optional. Ein PDF mit demselben Dateinamen ersetzt die frühere Fassung.
          </Text>
          <input
            ref={fileInput}
            type='file'
            accept='.pdf,.bib'
            multiple
            hidden
            onChange={event => {
              setError(null)
              addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <Button variant='outline' size='sm' onClick={() => fileInput.current?.click()}>
            Dateien auswählen
          </Button>

          <Stack mt={6} gap={2} align='center'>
            <FileSlot label='PDF' file={pdf} missing='noch kein PDF gewählt' />
            <FileSlot label='.bib' file={bib} missing='keine .bib (nur Weg B)' />
          </Stack>
          <Button mt={6} colorPalette='blue' disabled={!pdf} loading={uploading} onClick={upload}>
            <LuUpload /> Öffnen
          </Button>
        </Box>

        {error && (
          <Alert.Root status='error' mt={4}>
            <Alert.Indicator />
            <Alert.Title>{error}</Alert.Title>
          </Alert.Root>
        )}

        <Heading size='md' mt={10} mb={3}>
          Zuletzt geöffnet
        </Heading>
        {documents?.length === 0 && <Text color='fg.muted'>Noch keine Dokumente.</Text>}
        <Stack gap={2}>
          {documents?.map(document => (
            <Flex
              key={document.id}
              align='center'
              gap={3}
              p={3}
              bg='bg'
              borderWidth='1px'
              borderRadius='md'
              cursor='pointer'
              _hover={{ borderColor: 'blue.400' }}
              onClick={() => openDocument(document.id)}
            >
              <LuFileText />
              <Box flex={1} minWidth={0}>
                <Text fontWeight='medium' truncate>
                  {document.name}
                </Text>
                <Text fontSize='sm' color='fg.muted'>
                  hochgeladen {formatDate(document.uploaded_at)}
                </Text>
              </Box>
              <Badge colorPalette={document.has_bib ? 'green' : 'gray'}>
                {document.has_bib ? 'mit .bib' : 'ohne .bib'}
              </Badge>
              <IconButton
                aria-label='Dokument entfernen'
                title='Dokument entfernen'
                size='sm'
                variant='ghost'
                onClick={event => {
                  event.stopPropagation()
                  remove(document)
                }}
              >
                <LuTrash2 />
              </IconButton>
            </Flex>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}

function FileSlot({ label, file, missing }: { label: string; file: File | null; missing: string }) {
  return (
    <Flex gap={2} align='center' fontSize='sm'>
      <Badge colorPalette={file ? 'blue' : 'gray'}>{label}</Badge>
      <Text color={file ? 'fg' : 'fg.muted'}>{file ? file.name : missing}</Text>
    </Flex>
  )
}
