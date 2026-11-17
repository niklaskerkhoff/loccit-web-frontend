import { Box, Flex, IconButton, Spinner, Text } from '@chakra-ui/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { LuMinus, LuMoveHorizontal, LuPlus } from 'react-icons/lu'
import type { PageViewport } from 'pdfjs-dist'
import { loadPdf, pdfjsLib } from './pdfjs'
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import './PdfViewer.css'

const FIT_WIDTH = 'page-width'
const ZOOM_STEP = 1.2
const MIN_SCALE = 0.25
const MAX_SCALE = 5
const DESTROY_TIMEOUT_MS = 10_000
// Space left above a passage the viewer jumps to, in PDF points.
const FOCUS_MARGIN = 90

type PageRect = [number, number, number, number]

// A marked rectangle, in PDF user space of a 0-based page.
export type Highlight = { page: number; rect: PageRect; active: boolean }

// A place to scroll to. A new `key` scrolls again, even to the same place.
export type Focus = { page: number; rect: PageRect; key: string }

// The part of PDF.js's page view the highlight layer needs.
type PageView = {
  id: number
  div: HTMLElement
  viewport: PageViewport
}

type Props = {
  url: string
  // Rectangles to mark: all subtly, the active ones strongly.
  highlights?: Highlight[]
  focus?: Focus | null
  // Called for a click on a link annotation, with the link's target as
  // PDF.js writes it into the href ("#cite.key" for a named destination).
  // Returning true means the click was handled and PDF.js must not follow
  // the link.
  onLinkClick?: (annotationId: string, pageIndex: number, href: string) => boolean
  // Shown at the start of the toolbar.
  children?: ReactNode
}

function drawHighlights(pageView: PageView, highlights: Highlight[]) {
  let layer = pageView.div.querySelector<HTMLElement>(':scope > .loccit-highlights')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'loccit-highlights'
    pageView.div.append(layer)
  }
  const marks = highlights
    .filter(highlight => highlight.page === pageView.id - 1)
    .map(highlight => {
      const [x0, y0] = pageView.viewport.convertToViewportPoint(
        highlight.rect[0],
        highlight.rect[1],
      )
      const [x1, y1] = pageView.viewport.convertToViewportPoint(
        highlight.rect[2],
        highlight.rect[3],
      )
      const mark = document.createElement('div')
      mark.className = highlight.active ? 'loccit-highlight active' : 'loccit-highlight'
      mark.style.left = `${Math.min(x0, x1)}px`
      mark.style.top = `${Math.min(y0, y1)}px`
      mark.style.width = `${Math.abs(x1 - x0)}px`
      mark.style.height = `${Math.abs(y1 - y0)}px`
      return mark
    })
  layer.replaceChildren(...marks)
}

function scrollTo(viewer: PDFViewer, focus: Focus) {
  // XYZ with no left and no zoom: keep both, put the passage near the top.
  const top = focus.rect[3] + FOCUS_MARGIN
  viewer.scrollPageIntoView({
    pageNumber: focus.page + 1,
    destArray: [null, { name: 'XYZ' }, null, top, null],
  })
}

// A full PDF.js viewer: lazy page rendering, text selection, working internal
// links, zoom, and marked passages.
export function PdfViewer({ url, highlights, focus, onLinkClick, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PDFViewer | null>(null)
  const readyRef = useRef(false)
  const highlightsRef = useRef<Highlight[]>([])
  const focusRef = useRef<Focus | null>(null)
  const onLinkClickRef = useRef(onLinkClick)
  const [loaded, setLoaded] = useState<{ url: string; error: string | null } | null>(null)
  const [page, setPage] = useState({ current: 1, total: 0 })
  const [scale, setScale] = useState(1)

  useEffect(() => {
    onLinkClickRef.current = onLinkClick
  })

  useEffect(() => {
    const host = hostRef.current!
    // PDF.js needs an absolutely positioned scroll container of its own. It
    // is created here rather than rendered by React, so that each viewer
    // instance gets a fresh element with no listeners left on it.
    const container = document.createElement('div')
    container.className = 'pdf-scroll-container'
    const pages = document.createElement('div')
    pages.className = 'pdfViewer'
    container.append(pages)
    host.append(container)

    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    const viewer = new PDFViewer({
      container,
      viewer: pages,
      eventBus,
      linkService,
      annotationMode: pdfjsLib.AnnotationMode.ENABLE,
    })
    linkService.setViewer(viewer)
    viewerRef.current = viewer

    eventBus.on('pagesinit', () => {
      viewer.currentScaleValue = FIT_WIDTH
      setPage({ current: 1, total: viewer.pagesCount })
      readyRef.current = true
      if (focusRef.current) scrollTo(viewer, focusRef.current)
    })
    // A page loses its highlight layer whenever PDF.js renders it anew.
    eventBus.on('pagerendered', ({ source }: { source: PageView }) =>
      drawHighlights(source, highlightsRef.current),
    )
    eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) =>
      setPage(page => ({ ...page, current: pageNumber })),
    )
    eventBus.on('scalechanging', ({ scale }: { scale: number }) => setScale(scale))

    // Runs before PDF.js's own handler on the link element.
    const onClick = (event: MouseEvent) => {
      const annotation = (event.target as Element).closest<HTMLElement>('[data-annotation-id]')
      const pageNumber = annotation?.closest<HTMLElement>('.page')?.dataset.pageNumber
      if (!annotation || !pageNumber) return
      const id = annotation.dataset.annotationId!
      const href = annotation.querySelector('a')?.getAttribute('href') ?? ''
      if (onLinkClickRef.current?.(id, Number(pageNumber) - 1, href)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    container.addEventListener('click', onClick, true)

    // Keep "fit width" fitting when the pane is resized.
    const resizeObserver = new ResizeObserver(() => {
      if (viewer.pagesCount && viewer.currentScaleValue === FIT_WIDTH) {
        viewer.currentScaleValue = FIT_WIDTH
      }
    })
    resizeObserver.observe(container)

    let cancelled = false
    const loadingTask = loadPdf(url)
    loadingTask.promise.then(
      pdf => {
        if (cancelled) return
        viewer.setDocument(pdf)
        linkService.setDocument(pdf, null)
        setLoaded({ url, error: null })
      },
      (error: Error) => {
        if (!cancelled) setLoaded({ url, error: error.message })
      },
    )

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      viewerRef.current = null
      readyRef.current = false
      container.remove()
      // PDF.js may still be fetching the pages of a document that was just
      // opened. Taking the document away under it makes every pending page
      // fail loudly, so let it finish first, but do not wait forever.
      const pagesLoaded: Promise<unknown> = viewer.pagesPromise ?? Promise.resolve()
      const timeout = new Promise(resolve => setTimeout(resolve, DESTROY_TIMEOUT_MS))
      Promise.race([pagesLoaded, timeout])
        .catch(() => {})
        .then(() => {
          viewer.setDocument(null)
          loadingTask.destroy()
        })
    }
  }, [url])

  useEffect(() => {
    highlightsRef.current = highlights ?? []
    const viewer = viewerRef.current
    if (!viewer || !readyRef.current) return
    for (let index = 0; index < viewer.pagesCount; index++) {
      const pageView: PageView | undefined = viewer.getPageView(index)
      if (pageView?.div.querySelector('canvas')) drawHighlights(pageView, highlightsRef.current)
    }
  }, [highlights, url])

  // Declared after the effect that creates the viewer: for a new PDF the
  // jump waits for `pagesinit`.
  const focusKey = focus?.key
  useEffect(() => {
    focusRef.current = focus ?? null
    if (focus && viewerRef.current && readyRef.current) scrollTo(viewerRef.current, focus)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the focus
  }, [focusKey, url])

  const zoom = (factor: number) => {
    const viewer = viewerRef.current
    if (!viewer) return
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewer.currentScale * factor))
    viewer.currentScaleValue = String(next)
  }
  const fitWidth = () => {
    if (viewerRef.current) viewerRef.current.currentScaleValue = FIT_WIDTH
  }

  const state = loaded?.url === url ? loaded : null
  return (
    <Flex direction='column' height='100%' minWidth={0}>
      <Flex
        align='center'
        gap={1}
        px={2}
        height='40px'
        flexShrink={0}
        borderBottomWidth='1px'
        bg='bg.subtle'
      >
        <Box flex={1} minWidth={0}>
          {children}
        </Box>
        <Text fontSize='sm' color='fg.muted' whiteSpace='nowrap' mr={2}>
          {page.total ? `S. ${page.current} / ${page.total}` : ''}
        </Text>
        <IconButton
          aria-label='Verkleinern'
          size='xs'
          variant='ghost'
          onClick={() => zoom(1 / ZOOM_STEP)}
        >
          <LuMinus />
        </IconButton>
        <Text fontSize='sm' width='3.2em' textAlign='center'>
          {Math.round(scale * 100)} %
        </Text>
        <IconButton
          aria-label='Vergrößern'
          size='xs'
          variant='ghost'
          onClick={() => zoom(ZOOM_STEP)}
        >
          <LuPlus />
        </IconButton>
        <IconButton
          aria-label='An Breite anpassen'
          title='An Breite anpassen'
          size='xs'
          variant='ghost'
          onClick={fitWidth}
        >
          <LuMoveHorizontal />
        </IconButton>
      </Flex>
      <Box ref={hostRef} position='relative' flex={1} minHeight={0} bg='gray.200'>
        {!state && (
          <Flex position='absolute' inset={0} align='center' justify='center' zIndex={1}>
            <Spinner />
          </Flex>
        )}
        {state?.error && (
          <Flex position='absolute' inset={0} align='center' justify='center' zIndex={1} p={6}>
            <Text color='fg.error'>Das PDF konnte nicht geladen werden: {state.error}</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  )
}
