# NPTEL Interactive Quiz Platform — Responsible AI

A modern dark-theme React application that creates a multi-mode quiz platform for the NPTEL Responsible AI course from yearly assignment sources.

## Features

- Year-wise quiz
- Week-wise quiz (inside a selected year)
- Full syllabus quiz (all years)
- Standard mode with next/previous navigation, flagging and submit flow
- Rapid Fire mode with instant correctness feedback and quick transitions
- Detailed results dashboard:
  - Total score
  - Correct vs incorrect
  - Accuracy
  - Weak areas by year/week
  - Question-wise review with selected answer, correct answer and detailed solution
- Search/filter questions
- Bookmark questions and re-run bookmarked-only quizzes
- Local progress persistence

## Data Pipeline

Source material lives in the RAI folder inside this project. Each year folder holds a
`questions.json` transcribed from that year's assignments, plus an `images/` folder with the figures
that questions refer to:

- RAI/2024/ (assignment PDFs, questions.json, images/)
- RAI/2025/ (questions.json, once added)
- RAI/2026/ (solution PDFs, questions.json)

Generate the app data:

```bash
npm run extract:pdf
```

This command creates:

- public/data/quiz-data.json
- public/data/images/<year>/ (copied figures)

## Run Locally

```bash
npm install
npm run extract:pdf
npm run dev
```

Build for production:

```bash
npm run build
```

## Project Structure

- src/context/QuizContext.tsx: global quiz state, timer, persistence, session flow
- src/components/ControlPanel.tsx: mode/year/week/filter controls
- src/components/QuizCard.tsx: question UI, options, rapid feedback, navigation
- src/components/ResultsDashboard.tsx: score, analytics, and breakdown
- src/utils/quiz.ts: pool building, scoring, weak-area aggregation
- src/types/quiz.ts: shared TypeScript models
- scripts/extract-pdfs.mjs: validates each year's questions.json and generates the app data

## Notes

- `questions.json` format per year: `[{ week, questions: [{ prompt, options: [...], answers: ["b"], solution?, images?: ["images/x.png"] }] }]`.
- Questions with more than one entry in `answers` are multi-select: pick every correct option. In Rapid Fire
  mode a "Check Answer" button reveals the result.
- Multi-select questions give partial marks: (correct options ticked − wrong options ticked) ÷ number of correct options, never below 0.
- "Shuffle questions + options" randomizes the question order and the option order (options are re-labelled a, b, c… and the answer key follows). Questions whose options refer to each other, such as "All of the above", keep their original option order.
- Numerical-answer questions (no options) are not included.
