/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type {
  CustomWeekSelection,
  CustomQuizOrder,
  Question,
  QuizDataset,
  QuizMode,
  QuizSelection,
  QuizSession,
} from '../types/quiz'
import { getPool } from '../utils/quiz'

interface QuizContextValue {
  dataset: QuizDataset | null
  loading: boolean
  error: string | null
  selection: QuizSelection
  setSelection: (next: Partial<QuizSelection>) => void
  bookmarks: string[]
  toggleBookmark: (id: string) => void
  customWeekSelection: CustomWeekSelection
  setCustomWeekSelection: (next: CustomWeekSelection) => void
  customQuizOrder: CustomQuizOrder
  setCustomQuizOrder: (next: CustomQuizOrder) => void
  session: QuizSession
  currentQuestion: Question | null
  progress: number
  startQuiz: (
    mode: QuizMode,
    source?: 'default' | 'custom',
    customVariant?: 'weeks' | 'random15',
  ) => void
  answerQuestion: (questionId: string, option: string) => void
  setIndex: (index: number) => void
  nextQuestion: () => void
  previousQuestion: () => void
  toggleFlag: (questionId: string) => void
  submitQuiz: () => void
  resetQuiz: () => void
}

const QuizContext = createContext<QuizContextValue | null>(null)

const QUIZ_STATE_KEY = 'quiz-app-state-psy-v1'
const BOOKMARK_KEY = 'quiz-app-bookmarks-psy-v1'

const defaultSelection: QuizSelection = {
  scope: 'year',
  year: '2024',
  week: 1,
  bookmarkedOnly: false,
  searchTerm: '',
  shuffle: 'none',
}

const defaultSession: QuizSession = {
  started: false,
  submitted: false,
  mode: 'standard',
  questions: [],
  index: 0,
  answers: {},
  flagged: [],
  revealed: [],
  startedAt: 0,
  elapsedSeconds: 0,
}

const defaultCustomWeekSelection: CustomWeekSelection = {}
const defaultCustomQuizOrder: CustomQuizOrder = 'serial'

function loadStoredSession(): QuizSession {
  try {
    const raw = localStorage.getItem(QUIZ_STATE_KEY)
    if (!raw) {
      return defaultSession
    }
    return { ...defaultSession, ...JSON.parse(raw) }
  } catch {
    return defaultSession
  }
}

function loadBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<QuizDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelectionState] = useState<QuizSelection>(defaultSelection)
  const [session, setSession] = useState<QuizSession>(loadStoredSession)
  const [bookmarks, setBookmarks] = useState<string[]>(loadBookmarks)
  const [customWeekSelection, setCustomWeekSelection] = useState<CustomWeekSelection>(
    defaultCustomWeekSelection,
  )
  const [customQuizOrder, setCustomQuizOrder] = useState<CustomQuizOrder>(
    defaultCustomQuizOrder,
  )

  useEffect(() => {
    fetch('/data/quiz-data.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load quiz data. Run npm run extract:pdf first.')
        }
        return response.json()
      })
      .then((payload: QuizDataset) => {
        setDataset(payload)
        if (!defaultSelection.year && payload.years.length > 0) {
          setSelectionState((prev) => ({ ...prev, year: payload.years[0].year, week: 1 }))
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks))
  }, [bookmarks])

  useEffect(() => {
    if (!session.started || session.submitted) {
      return
    }

    const timer = window.setInterval(() => {
      setSession((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [session.started, session.submitted])

  const setSelection = useCallback((next: Partial<QuizSelection>) => {
    setSelectionState((prev) => ({ ...prev, ...next }))
  }, [])

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }, [])

  const startQuiz = useCallback(
    (
      mode: QuizMode,
      source: 'default' | 'custom' = 'default',
      customVariant: 'weeks' | 'random15' = 'weeks',
    ) => {
      if (!dataset) {
        return
      }
      const pool = getPool(
        dataset,
        selection,
        bookmarks,
        customWeekSelection,
        source === 'custom',
        customQuizOrder,
      )
      const finalPool =
        source === 'custom' && customVariant === 'random15'
          ? getPool(
              dataset,
              { ...selection, shuffle: 'random15', scope: 'full' },
              bookmarks,
            )
          : pool
      setSession({
        ...defaultSession,
        started: true,
        mode,
        questions: finalPool,
        startedAt: Date.now(),
      })
    },
    [dataset, selection, bookmarks, customWeekSelection, customQuizOrder],
  )

  const answerQuestion = useCallback(
    (questionId: string, option: string) => {
      setSession((prev) => {
        const nextRevealed =
          prev.mode === 'rapid' ? [...new Set([...prev.revealed, questionId])] : prev.revealed

        return {
          ...prev,
          answers: { ...prev.answers, [questionId]: option },
          revealed: nextRevealed,
        }
      })
    },
    [],
  )

  const setIndex = useCallback((index: number) => {
    setSession((prev) => ({
      ...prev,
      index: Math.max(0, Math.min(index, prev.questions.length - 1)),
    }))
  }, [])

  const nextQuestion = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      index: Math.min(prev.index + 1, prev.questions.length - 1),
    }))
  }, [])

  const previousQuestion = useCallback(() => {
    setSession((prev) => ({ ...prev, index: Math.max(prev.index - 1, 0) }))
  }, [])

  const toggleFlag = useCallback((questionId: string) => {
    setSession((prev) => ({
      ...prev,
      flagged: prev.flagged.includes(questionId)
        ? prev.flagged.filter((id) => id !== questionId)
        : [...prev.flagged, questionId],
    }))
  }, [])

  const submitQuiz = useCallback(() => {
    setSession((prev) => ({ ...prev, submitted: true }))
  }, [])

  const resetQuiz = useCallback(() => {
    setSession(defaultSession)
  }, [])

  const currentQuestion = useMemo(() => {
    if (!session.started || session.questions.length === 0) {
      return null
    }
    return session.questions[session.index] ?? null
  }, [session])

  const progress = useMemo(() => {
    if (!session.started || session.questions.length === 0) {
      return 0
    }
    return ((session.index + 1) / session.questions.length) * 100
  }, [session])

  const value = useMemo<QuizContextValue>(
    () => ({
      dataset,
      loading,
      error,
      selection,
      setSelection,
      bookmarks,
      toggleBookmark,
      customWeekSelection,
      setCustomWeekSelection,
      customQuizOrder,
      setCustomQuizOrder,
      session,
      currentQuestion,
      progress,
      startQuiz,
      answerQuestion,
      setIndex,
      nextQuestion,
      previousQuestion,
      toggleFlag,
      submitQuiz,
      resetQuiz,
    }),
    [
      dataset,
      loading,
      error,
      selection,
      setSelection,
      bookmarks,
      toggleBookmark,
      customWeekSelection,
      setCustomWeekSelection,
      customQuizOrder,
      setCustomQuizOrder,
      session,
      currentQuestion,
      progress,
      startQuiz,
      answerQuestion,
      setIndex,
      nextQuestion,
      previousQuestion,
      toggleFlag,
      submitQuiz,
      resetQuiz,
    ],
  )

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>
}

export function useQuiz() {
  const context = useContext(QuizContext)
  if (!context) {
    throw new Error('useQuiz must be used within QuizProvider')
  }
  return context
}
