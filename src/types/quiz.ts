export type QuizMode = 'standard' | 'rapid'
export type ScopeType = 'year' | 'week' | 'full'
export type ShuffleMode = 'none' | 'week' | 'year' | 'random15'
export type CustomWeekSelection = Record<string, number[]>
export type CustomQuizOrder = 'serial' | 'shuffle'

export interface Option {
  key: string
  text: string
}

export interface Question {
  id: string
  prompt: string
  options: Option[]
  correctAnswer: string
  correctText: string
  solution: string
  multi?: boolean
  images?: string[]
  year: string
  week: number
}

export interface WeekData {
  week: number
  questions: Question[]
}

export interface YearData {
  year: string
  weeks: WeekData[]
}

export interface QuizDataset {
  generatedAt: string
  years: YearData[]
}

export interface QuizSelection {
  scope: ScopeType
  year?: string
  week?: number
  bookmarkedOnly: boolean
  searchTerm: string
  shuffle: ShuffleMode
}

export interface QuizSession {
  started: boolean
  submitted: boolean
  mode: QuizMode
  questions: Question[]
  index: number
  answers: Record<string, string>
  flagged: string[]
  revealed: string[]
  startedAt: number
  elapsedSeconds: number
}
