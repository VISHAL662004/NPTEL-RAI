import { CheckCircle2, CircleX, MinusCircle, RotateCcw, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useQuiz } from '../context/QuizContext'
import { QuestionTable } from './QuestionTable'
import { calculateScore, describeAnswer, questionCredit, weakAreas } from '../utils/quiz'

const formatMarks = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2))

export function ResultsDashboard() {
  const { session, resetQuiz } = useQuiz()
  const radius = 72
  const circumference = 2 * Math.PI * radius

  const metrics = useMemo(
    () => calculateScore(session.questions, session.answers),
    [session.answers, session.questions],
  )

  const weak = useMemo(
    () => weakAreas(session.questions, session.answers),
    [session.answers, session.questions],
  )

  const dashOffset = circumference * (1 - Math.min(metrics.accuracy, 100) / 100)

  const tone = useMemo(() => {
    if (metrics.accuracy >= 80) {
      return 'excellent'
    }
    if (metrics.accuracy >= 50) {
      return 'steady'
    }
    return 'focus'
  }, [metrics.accuracy])

  return (
    <section className="panel results-panel">
      <header className="results-header">
        <div>
          <h2>Performance Dashboard</h2>
          <p>
            Score: {formatMarks(metrics.score)}/{session.questions.length} • Accuracy:{' '}
            {metrics.accuracy.toFixed(1)}%
          </p>
        </div>
        <button className="action-btn" onClick={resetQuiz}>
          <RotateCcw size={16} /> New Quiz
        </button>
      </header>

      <motion.section
        className={`radial-score-card ${tone}`}
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="radial-wrap">
          <svg viewBox="0 0 180 180" className="radial-svg" aria-label="Accuracy score chart">
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--score-start)" />
                <stop offset="100%" stopColor="var(--score-end)" />
              </linearGradient>
            </defs>
            <circle className="radial-track" cx="90" cy="90" r={radius} />
            <motion.circle
              className="radial-progress"
              cx="90"
              cy="90"
              r={radius}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.12 }}
              strokeDasharray={circumference}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
            />
          </svg>
          <div className="radial-center">
            <strong>{metrics.accuracy.toFixed(1)}%</strong>
            <span>Accuracy</span>
          </div>
        </div>
        <div className="radial-meta">
          <h3>Score Pulse</h3>
          <p>
            Correct: {metrics.correct} • Partial: {metrics.partial} • Incorrect: {metrics.incorrect}
          </p>
          <p>
            {tone === 'excellent'
              ? 'Excellent consistency. Keep pushing for perfect runs.'
              : tone === 'steady'
                ? 'Solid baseline. Review weak areas for a quick jump.'
                : 'Focus mode. Start with the missed concepts.'}
          </p>
        </div>
      </motion.section>

      <div className="stat-grid">
        <article>
          <CheckCircle2 size={18} />
          <h3>{metrics.correct}</h3>
          <p>Correct</p>
        </article>
        <article>
          <MinusCircle size={18} />
          <h3>{metrics.partial}</h3>
          <p>Partial</p>
        </article>
        <article>
          <CircleX size={18} />
          <h3>{metrics.incorrect}</h3>
          <p>Incorrect</p>
        </article>
        <article>
          <Sparkles size={18} />
          <h3>{metrics.accuracy.toFixed(1)}%</h3>
          <p>Overall accuracy</p>
        </article>
      </div>

      <section className="weak-list">
        <h3>Weak Areas</h3>
        {weak.length === 0 ? (
          <p>No data to show.</p>
        ) : (
          weak.map((item) => (
            <div key={item.label} className="weak-item">
              <span>{item.label}</span>
              <strong>{item.accuracy.toFixed(0)}% ({item.total} questions)</strong>
            </div>
          ))
        )}
      </section>

      <section className="breakdown">
        <h3>Question-wise Breakdown</h3>
        <div className="breakdown-list">
          {session.questions.map((question, index) => {
            const selected = session.answers[question.id]
            const credit = questionCredit(question, selected)
            const status = credit === 1 ? 'correct' : credit > 0 ? 'partial' : 'incorrect'
            return (
              <article key={question.id} className={`breakdown-item ${status}`}>
                <p className="q-title">
                  Q{index + 1}. {question.prompt}
                </p>
                {question.table && <QuestionTable table={question.table} />}
                <p>
                  Selected: <strong>{describeAnswer(question, selected)}</strong>
                </p>
                <p>
                  Correct: <strong>{describeAnswer(question, question.correctAnswer)}</strong>
                </p>
                {status === 'partial' && <p>Partial marks: {formatMarks(credit)}/1</p>}
                <p className="solution">Solution: {question.solution}</p>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
