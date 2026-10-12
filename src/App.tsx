import { motion } from 'framer-motion'
import { ControlPanel } from './components/ControlPanel'
import { QuizCard } from './components/QuizCard'
import { ResultsDashboard } from './components/ResultsDashboard'
import { useQuiz } from './context/QuizContext'

function App() {
  const { loading, error, session } = useQuiz()

  if (loading) {
    return (
      <main className="shell">
        <div className="loading-screen panel">
          <h1>Preparing question bank...</h1>
          <p>Load generated quiz data from the three yearly PDFs.</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="shell">
        <div className="loading-screen panel">
          <h1>Data load error</h1>
          <p>{error}</p>
          <p>Run npm run extract:pdf and restart the dev server.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="shell">
      <motion.section
        className="hero-strip panel"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p className="hero-kicker">NPTEL Multi-Year Practice Arena</p>
          <h1>Psychology of Learning</h1>
          <p className="hero-credit">Made by Vishal Kumar</p>
        </div>
        <p className="hero-sub">
          Year-wise, week-wise, and full syllabus drills with instant review and
          detailed solution tracking.
        </p>
      </motion.section>

      <section className="workspace-grid">
        {!session.started ? (
          <ControlPanel />
        ) : session.submitted ? (
          <ResultsDashboard />
        ) : (
          <QuizCard />
        )}
      </section>
    </main>
  )
}

export default App
