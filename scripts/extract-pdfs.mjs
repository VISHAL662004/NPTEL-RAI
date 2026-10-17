import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const sourceRoot = path.resolve(root, 'RAI')
const imageOut = path.resolve(root, 'public', 'data', 'images')

// Each year folder holds a questions.json transcribed from that year's assignment PDFs
// (or answer videos), plus an images/ folder with the figures the questions refer to.
const YEARS = ['2024', '2025', '2026']

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

async function exists(p) {
  return Boolean(await fs.stat(p).catch(() => null))
}

function buildQuestion(item, year, week, number) {
  const id = `${year}-W${week}-Q${number}`
  // Numerical-answer question: no options, just a number (with an optional tolerance).
  if (item.numeric) {
    if (!item.prompt || typeof item.numeric.answer !== 'number') {
      throw new Error(`${id}: numeric questions need a prompt and a numeric answer`)
    }
    return {
      id,
      prompt: item.prompt,
      options: [],
      correctAnswer: String(item.numeric.answer),
      correctText: String(item.numeric.answer),
      solution: item.solution || 'Solution not found in source text.',
      year,
      week,
      numeric: true,
      tolerance: item.numeric.tolerance ?? 0.01,
    }
  }
  if (!item.prompt || !Array.isArray(item.options) || item.options.length < 2) {
    throw new Error(`${id}: needs a prompt and at least 2 options`)
  }
  if (item.options.length > OPTION_KEYS.length) {
    throw new Error(`${id}: too many options`)
  }
  const options = item.options.map((text, i) => ({ key: OPTION_KEYS[i], text }))
  const answers = [...new Set(item.answers ?? [])].sort()
  if (answers.length === 0) {
    throw new Error(`${id}: no answer`)
  }
  for (const key of answers) {
    if (!options.some((option) => option.key === key)) {
      throw new Error(`${id}: answer "${key}" is not an option`)
    }
  }

  const question = {
    id,
    prompt: item.prompt,
    options,
    // Multi-select answers are stored as sorted keys joined by commas, e.g. "b,d".
    correctAnswer: answers.join(','),
    correctText: answers.map((key) => options.find((option) => option.key === key).text).join(' | '),
    solution: item.solution || 'Solution not found in source text.',
    year,
    week,
  }
  if (answers.length > 1) {
    question.multi = true
  }
  if (item.table) {
    question.table = item.table
  }
  if (item.images?.length) {
    question.images = item.images.map((file) => `data/images/${year}/${path.basename(file)}`)
  }
  return question
}

async function parseYear(year) {
  const dir = path.join(sourceRoot, year)
  const jsonPath = path.join(dir, 'questions.json')
  if (!(await exists(jsonPath))) {
    return null
  }

  const source = JSON.parse(await fs.readFile(jsonPath, 'utf8'))
  const seen = new Set()
  const weeks = source
    .map((entry) => {
      if (seen.has(entry.week)) {
        throw new Error(`${year}: week ${entry.week} appears more than once`)
      }
      seen.add(entry.week)
      return {
        week: entry.week,
        questions: entry.questions.map((item, index) => buildQuestion(item, year, entry.week, index + 1)),
      }
    })
    .sort((a, b) => a.week - b.week)

  const imageDir = path.join(dir, 'images')
  if (await exists(imageDir)) {
    const target = path.join(imageOut, year)
    await fs.mkdir(target, { recursive: true })
    for (const file of await fs.readdir(imageDir)) {
      await fs.copyFile(path.join(imageDir, file), path.join(target, file))
    }
  }
  for (const week of weeks) {
    for (const question of week.questions) {
      for (const image of question.images ?? []) {
        if (!(await exists(path.join(root, 'public', image)))) {
          throw new Error(`${question.id}: missing image ${image}`)
        }
      }
    }
  }

  return { year, weeks }
}

async function main() {
  await fs.rm(imageOut, { recursive: true, force: true })

  const years = []
  for (const year of YEARS) {
    const parsed = await parseYear(year)
    if (parsed) {
      years.push(parsed)
    } else {
      console.log(`No questions.json for ${year}; skipped`)
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    years,
  }

  const outPath = path.join(root, 'public', 'data', 'quiz-data.json')
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')

  console.log('Created public/data/quiz-data.json')
  console.table(
    years.map((year) => ({
      year: year.year,
      weeks: year.weeks.length,
      questions: year.weeks.reduce((sum, week) => sum + week.questions.length, 0),
    })),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
