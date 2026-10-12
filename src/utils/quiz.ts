import type {
  CustomWeekSelection,
  CustomQuizOrder,
  Question,
  QuizDataset,
  QuizSelection,
} from '../types/quiz'

export function flattenQuestions(dataset: QuizDataset): Question[] {
  return dataset.years.flatMap((year) =>
    year.weeks.flatMap((week) => week.questions),
  )
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function getRandomSubset<T>(arr: T[], count: number): T[] {
  const shuffled = shuffleArray(arr)
  return shuffled.slice(0, Math.min(count, arr.length))
}

export function getPool(
  dataset: QuizDataset,
  selection: QuizSelection,
  bookmarks: string[],
  customWeekSelection?: CustomWeekSelection,
  useCustomWeekSelection = false,
  customQuizOrder: CustomQuizOrder = 'serial',
): Question[] {
  let pool: Question[]

  if (useCustomWeekSelection) {
    const selectedPairs = new Set(
      Object.entries(customWeekSelection ?? {}).flatMap(([year, weeks]) =>
        weeks.map((week) => `${year}-${week}`),
      ),
    )

    pool = flattenQuestions(dataset).filter((question) =>
      selectedPairs.has(`${question.year}-${question.week}`),
    )

    if (customQuizOrder === 'shuffle') {
      pool = shuffleArray(pool)
    }
  } else {
    // Handle different shuffle modes
    if (selection.shuffle === 'random15') {
      // Get 15 random questions from entire dataset
      const allQuestions = flattenQuestions(dataset)
      pool = getRandomSubset(allQuestions, 15)
    } else if (selection.shuffle === 'year') {
      // Shuffle questions within selected year
      pool = flattenQuestions(dataset)
      if (selection.year) {
        pool = pool.filter((q) => q.year === selection.year)
      }
      pool = shuffleArray(pool)
    } else if (selection.shuffle === 'week') {
      // Shuffle questions within selected week
      pool = flattenQuestions(dataset)
      if (selection.year && selection.week) {
        pool = pool.filter(
          (q) => q.year === selection.year && q.week === selection.week,
        )
      }
      pool = shuffleArray(pool)
    } else {
      // No shuffle - original behavior
      pool = flattenQuestions(dataset)

      if (selection.scope === 'year' && selection.year) {
        pool = pool.filter((q) => q.year === selection.year)
      }

      if (selection.scope === 'week' && selection.year && selection.week) {
        pool = pool.filter(
          (q) => q.year === selection.year && q.week === selection.week,
        )
      }
    }
  }

  if (selection.bookmarkedOnly) {
    const lookup = new Set(bookmarks)
    pool = pool.filter((q) => lookup.has(q.id))
  }

  const term = selection.searchTerm.trim().toLowerCase()
  if (term.length > 0) {
    pool = pool.filter((q) => {
      const joined = `${q.prompt} ${q.options.map((o) => o.text).join(' ')} ${q.solution}`
      return joined.toLowerCase().includes(term)
    })
  }

  return pool
}

export function calculateScore(
  questions: Question[],
  answers: Record<string, string>,
): { correct: number; incorrect: number; accuracy: number } {
  const correct = questions.filter((q) => answers[q.id] === q.correctAnswer).length
  const incorrect = questions.length - correct
  const accuracy = questions.length > 0 ? (correct / questions.length) * 100 : 0

  return { correct, incorrect, accuracy }
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function weakAreas(
  questions: Question[],
  answers: Record<string, string>,
): Array<{ label: string; accuracy: number; total: number }> {
  const byWeek = new Map<string, { total: number; correct: number }>()

  for (const question of questions) {
    const label = `${question.year} / Week ${question.week}`
    const snapshot = byWeek.get(label) ?? { total: 0, correct: 0 }
    snapshot.total += 1
    if (answers[question.id] === question.correctAnswer) {
      snapshot.correct += 1
    }
    byWeek.set(label, snapshot)
  }

  return [...byWeek.entries()]
    .map(([label, metric]) => ({
      label,
      total: metric.total,
      accuracy: metric.total > 0 ? (metric.correct / metric.total) * 100 : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6)
}

// Multi-select answers are stored as sorted option keys joined by commas, e.g. "b,d".
export function splitAnswer(answer: string | undefined): string[] {
  return answer ? answer.split(',') : []
}

export function joinAnswer(keys: string[]): string {
  return [...keys].sort().join(',')
}

export function describeAnswer(question: Question, answer: string | undefined): string {
  const keys = splitAnswer(answer)
  if (keys.length === 0) {
    return 'Not answered'
  }
  return keys
    .map((key) => `${key.toUpperCase()} - ${question.options.find((opt) => opt.key === key)?.text ?? 'Unknown'}`)
    .join('; ')
}
