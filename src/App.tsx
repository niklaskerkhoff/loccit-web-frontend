import { DocumentPage } from './pages/DocumentPage'
import { StartPage } from './pages/StartPage'
import { useRoute } from './routing'

export default function App() {
  const route = useRoute()
  if (route.page === 'document') {
    // The key gives every document a fresh page state.
    return <DocumentPage key={route.id} documentId={route.id} />
  }
  return <StartPage />
}
