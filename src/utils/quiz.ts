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

// Options that point at each other ("All of the above", "Both A and B") only make sense in their
// original order, so those questions keep their options where they are.
const POSITION_DEPENDENT = /of the above|of these|\b(both|option|options)\s+[a-e]\b|\b[a-e]\s+(and|&)\s+[a-e]\b|\b[a-e]\s+or\s+[a-e]\b/i

// Shuffles the options, re-labels them a, b, c... and re-maps the correct answer to the new labels.
export function shuffleOptions(question: Question): Question {
  if (question.numeric || question.options.some((option) => POSITION_DEPENDENT.test(option.text))) {
    return question
  }
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const correct = new Set(splitAnswer(question.correctAnswer))
  const options = shuffleArray(question.options).map((option, index) => ({
    option,
    key: keys[index],
  }))
  return {
    ...question,
    options: options.map(({ option, key }) => ({ key, text: option.text })),
    correctAnswer: joinAnswer(options.filter(({ option }) => correct.has(option.key)).map(({ key }) => key)),
  }
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
      pool = shuffleArray(pool).map(shuffleOptions)
    }
  } else {
    // Handle different shuffle modes
    if (selection.shuffle === 'random15') {
      // Get 15 random questions from entire dataset
      const allQuestions = flattenQuestions(dataset)
      pool = getRandomSubset(allQuestions, 15).map(shuffleOptions)
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

// Credit for one question, from 0 to 1. Single-answer questions are all or nothing. Multi-select
// questions are marked partially: each correct option ticked earns 1/n of the credit and each wrong
// option ticked takes 1/n away, never going below 0.
export function questionCredit(question: Question, answer: string | undefined): number {
  if (question.numeric) {
    const value = Number(answer)
    const target = Number(question.correctAnswer)
    return answer?.trim() && Math.abs(value - target) <= (question.tolerance ?? 0.01) ? 1 : 0
  }
  const selected = splitAnswer(answer)
  if (!question.multi) {
    return answer === question.correctAnswer ? 1 : 0
  }
  const correctKeys = splitAnswer(question.correctAnswer)
  const hits = selected.filter((key) => correctKeys.includes(key)).length
  const wrong = selected.length - hits
  return Math.max(0, (hits - wrong) / correctKeys.length)
}

export function calculateScore(
  questions: Question[],
  answers: Record<string, string>,
): { score: number; correct: number; partial: number; incorrect: number; accuracy: number } {
  let score = 0
  let correct = 0
  let partial = 0
  for (const question of questions) {
    const credit = questionCredit(question, answers[question.id])
    score += credit
    if (credit === 1) {
      correct += 1
    } else if (credit > 0) {
      partial += 1
    }
  }
  const incorrect = questions.length - correct - partial
  const accuracy = questions.length > 0 ? (score / questions.length) * 100 : 0

  return { score, correct, partial, incorrect, accuracy }
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
    snapshot.correct += questionCredit(question, answers[question.id])
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
  if (question.numeric) {
    return answer?.trim() ? answer : 'Not answered'
  }
  const keys = splitAnswer(answer)
  if (keys.length === 0) {
    return 'Not answered'
  }
  return keys
    .map((key) => `${key.toUpperCase()} - ${question.options.find((opt) => opt.key === key)?.text ?? 'Unknown'}`)
    .join('; ')
}
