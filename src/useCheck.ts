import { useCallback, useEffect, useRef, useState } from 'react'
import { type Check, type Model, type Models, getCheck, getModels, runCheck } from './api'

type Selection = { model: string; thinking: string }

export type CheckController = {
  models: Models | null
  model: Model | null
  thinking: string
  selectModel: (id: string) => void
  selectThinking: (level: string) => void
  // The check for the open citation group and the selected model and level;
  // null while it is being fetched.
  check: Check | null
  // 'loading': fetching the stored run. 'running': a model is at work.
  busy: 'loading' | 'running' | null
  // The backend could not be reached.
  failure: string | null
  // Check now and store the result as a new run.
  recheck: () => void
}

const MODEL_KEY = 'loccit.model'
const thinkingKey = (model: string) => `loccit.thinking.${model}`

function remembered(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode: the choice just does not survive a reload.
  }
}

// The level last used with a model, or the model's default (its first level).
function levelFor(model: Model): string {
  const stored = remembered(thinkingKey(model.id))
  return stored && model.levels.includes(stored) ? stored : model.levels[0]
}

function initialSelection(models: Models): Selection | null {
  const stored = remembered(MODEL_KEY)
  const model =
    models.models.find(model => model.id === stored) ??
    models.models.find(model => model.id === models.default_model) ??
    models.models[0]
  return model ? { model: model.id, thinking: levelFor(model) } : null
}

// Keeps the check of the open citation group in step with the selected model
// and thinking level.
//
// `version` changes when the sources were read again; the stored run is then
// fetched again. `openToken` changes with every click on a citation: the
// first time a click finds no stored run, the check is started right away.
// Changing model or level never starts a check by itself.
export function useCheck(
  documentId: number,
  groupId: number | null,
  version: number,
  openToken: number,
  onResult: (check: Check) => void,
): CheckController {
  const [models, setModels] = useState<Models | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [result, setResult] = useState<{
    key: string
    check: Check | null
    failure: string | null
  } | null>(null)
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const keyRef = useRef<string | null>(null)
  const seenToken = useRef(-1)
  const onResultRef = useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    getModels().then(
      models => {
        setModels(models)
        setSelection(initialSelection(models))
      },
      () => setModels(null),
    )
  }, [])

  const key =
    groupId !== null && selection
      ? `${groupId}|${selection.model}|${selection.thinking}|${version}`
      : null

  const run = useCallback(
    (key: string, groupId: number, selection: Selection) => {
      setRunningKey(key)
      runCheck(documentId, groupId, selection.model, selection.thinking)
        .then(
          check => {
            if (keyRef.current !== key) return
            setResult({ key, check, failure: null })
            onResultRef.current(check)
          },
          (error: Error) => {
            if (keyRef.current === key) setResult({ key, check: null, failure: error.message })
          },
        )
        .finally(() => setRunningKey(current => (current === key ? null : current)))
    },
    [documentId],
  )

  const hasApiKey = models?.has_api_key ?? false
  useEffect(() => {
    keyRef.current = key
    if (key === null || groupId === null || !selection) return
    getCheck(documentId, groupId, selection.model, selection.thinking).then(
      check => {
        if (keyRef.current !== key) return
        setResult({ key, check, failure: null })
        const firstForThisClick = seenToken.current !== openToken
        seenToken.current = openToken
        if (check.run) onResultRef.current(check)
        else if (firstForThisClick && !check.error && hasApiKey) run(key, groupId, selection)
      },
      (error: Error) => {
        if (keyRef.current === key) setResult({ key, check: null, failure: error.message })
      },
    )
  }, [documentId, groupId, selection, key, openToken, hasApiKey, run])

  const current = result && result.key === key ? result : null
  const model = models?.models.find(model => model.id === selection?.model) ?? null
  return {
    models,
    model,
    thinking: selection?.thinking ?? '',
    selectModel: id => {
      const next = models?.models.find(model => model.id === id)
      if (!next) return
      remember(MODEL_KEY, id)
      setSelection({ model: id, thinking: levelFor(next) })
    },
    selectThinking: level => {
      if (!selection) return
      remember(thinkingKey(selection.model), level)
      setSelection({ ...selection, thinking: level })
    },
    check: current?.check ?? null,
    busy: key === null ? null : runningKey === key ? 'running' : current ? null : 'loading',
    failure: current?.failure ?? null,
    recheck: () => {
      if (key !== null && groupId !== null && selection) run(key, groupId, selection)
    },
  }
}
