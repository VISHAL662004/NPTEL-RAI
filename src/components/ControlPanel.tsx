import { Flame, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuiz } from '../context/QuizContext'

export function ControlPanel() {
  const {
    dataset,
    selection,
    setSelection,
    bookmarks,
    startQuiz,
    customWeekSelection,
    setCustomWeekSelection,
    customQuizOrder,
    setCustomQuizOrder,
  } = useQuiz()

  const [customSource, setCustomSource] = useState<'weeks' | 'random15'>('weeks')

  const selectedCustomCount = useMemo(
    () =>
      Object.values(customWeekSelection).reduce(
        (total, weekList) => total + weekList.length,
        0,
      ),
    [customWeekSelection],
  )

  const setWeeksForYear = (year: string, nextWeeks: number[]) => {
    setCustomWeekSelection(
      nextWeeks.length === 0
        ? Object.fromEntries(
            Object.entries(customWeekSelection).filter(([key]) => key !== year),
          )
        : { ...customWeekSelection, [year]: nextWeeks },
    )
  }

  const toggleCustomYear = (year: string) => {
    const yearWeeks =
      dataset?.years.find((item) => item.year === year)?.weeks.map((week) => week.week) ?? []
    const selectedWeeks = customWeekSelection[year] ?? []
    const isFullySelected = yearWeeks.length > 0 && selectedWeeks.length === yearWeeks.length

    setWeeksForYear(year, isFullySelected ? [] : yearWeeks)
  }

  const toggleCustomWeek = (year: string, week: number) => {
    const selectedWeeks = customWeekSelection[year] ?? []
    const nextWeeks = selectedWeeks.includes(week)
      ? selectedWeeks.filter((item) => item !== week)
      : [...selectedWeeks, week].sort((a, b) => a - b)

    setWeeksForYear(year, nextWeeks)
  }

  return (
    <aside className="panel setup-panel custom-panel">
      <div className="panel-title-row">
        <h2>Custom Week Quiz</h2>
      </div>
      <p className="custom-panel-note">
        Pick any years and week combinations, or switch to random 15 from the full bank.
      </p>

      <div className="custom-year-list">
        {dataset?.years.map((year) => {
          const selectedWeeks = customWeekSelection[year.year] ?? []
          const yearWeeks = year.weeks.map((week) => week.week)
          const yearChecked = yearWeeks.length > 0 && selectedWeeks.length === yearWeeks.length

          return (
            <section key={year.year} className="custom-year-card">
              <label className="custom-year-toggle">
                <input
                  type="checkbox"
                  checked={yearChecked}
                  onChange={() => toggleCustomYear(year.year)}
                />
                <span>{year.year}</span>
              </label>

              <div className="custom-week-grid">
                {year.weeks.map((week) => (
                  <label key={week.week} className="custom-week-chip">
                    <input
                      type="checkbox"
                      checked={selectedWeeks.includes(week.week)}
                      onChange={() => toggleCustomWeek(year.year, week.week)}
                    />
                    <span>Week {week.week}</span>
                  </label>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="custom-summary">{selectedCustomCount} weeks selected</div>

      <div className="custom-order-toggle">
        <button
          className={`select-btn ${customSource === 'weeks' && customQuizOrder === 'serial' ? 'active' : ''}`}
          onClick={() => {
            setCustomSource('weeks')
            setCustomQuizOrder('serial')
          }}
          type="button"
        >
          Serial wise
        </button>
        <button
          className={`select-btn ${customSource === 'weeks' && customQuizOrder === 'shuffle' ? 'active' : ''}`}
          onClick={() => {
            setCustomSource('weeks')
            setCustomQuizOrder('shuffle')
          }}
          type="button"
        >
          Shuffle questions + options
        </button>
        <button
          className={`select-btn ${customSource === 'random15' ? 'active' : ''}`}
          onClick={() => setCustomSource('random15')}
          type="button"
        >
          Random 15
        </button>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={selection.bookmarkedOnly}
          onChange={(event) => setSelection({ bookmarkedOnly: event.target.checked })}
        />
        <span>Use bookmarked questions only ({bookmarks.length})</span>
      </label>

      <div className="mode-actions">
        <button
          className="action-btn"
          onClick={() => startQuiz('standard', 'custom', customSource)}
          disabled={customSource === 'weeks' && selectedCustomCount === 0}
        >
          <Play size={16} /> Start Custom Standard Quiz
        </button>
        <button
          className="action-btn rapid"
          onClick={() => startQuiz('rapid', 'custom', customSource)}
          disabled={customSource === 'weeks' && selectedCustomCount === 0}
        >
          <Flame size={16} /> Start Custom Rapid Fire
        </button>
      </div>
    </aside>
  )
}
