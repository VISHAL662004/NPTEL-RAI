import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFParse } from 'pdf-parse'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const sourceRoot = path.resolve(root, 'Psyclogo_of_learning')

// 2024 and 2025 are single PDFs (week 0 to week 12). 2026 is a folder with one PDF per week.
const SOURCES = [
  { year: '2024', pdf: '2024-week-0-to-week-12.pdf' },
  { year: '2025', pdf: '2025-week-0-to-week-12.pdf' },
  { year: '2026', dir: '2026' },
]

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e']

const warnings = []

function warn(message) {
  warnings.push(message)
}

function normalizeText(text) {
  return text
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .replace(/[‐-‒]/g, '-')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\t+/g, ' ')
}

function cleanLine(line) {
  return line.replace(/\s+/g, ' ').trim()
}

const NOISE_PATTERNS = [
  /^NPTEL Online Certification Courses$/i,
  /^Indian Institute of Technology Kharagpur$/i,
  /^\*+\s*END\s*\*+$/i,
  /^_{5,}$/,
  /^-{5,}$/,
  /^-{2,}\s*\d+\s+of\s+\d+\s*-{2,}$/i,
  /^(Education for )?Psychology of Learning$/i,
  /^TYPE OF QUESTION/i,
  /^Number of questions/i,
  /^(July|January) 20\d\d\s*-/i,
]

function isNoiseLine(line) {
  // Short all-caps fragments are the "NPTEL" watermark leaking into the text layer.
  if (/^[A-Z ]{1,6}$/.test(line)) {
    return true
  }
  return NOISE_PATTERNS.some((pattern) => pattern.test(line))
}

function squash(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j += 1) {
    rows[0][j] = j
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return rows[a.length][b.length]
}

// Each assignment starts with a header such as "July 2024- 3 Assignment",
// "July 2025- Week 7 Assignment" or "July 2026- Assignment Week-03".
function splitByHeader(lines) {
  const headerRegex = /(July|January)\s+(20\d\d)\s*-/i
  const starts = []
  lines.forEach((line, index) => {
    if (headerRegex.test(line)) {
      starts.push(index)
    }
  })

  return starts.map((start, i) => {
    const header = lines[start]
    const end = i + 1 < starts.length ? starts[i + 1] : lines.length
    const weekMatch = header.match(/Week[\s-]*(\d+)/i) ?? header.match(/-\s*(\d+)\s*Assignment/i)
    return {
      headerYear: header.match(headerRegex)?.[2] ?? '',
      week: weekMatch ? Number(weekMatch[1]) : NaN,
      lines: lines.slice(start, end),
    }
  })
}

// Questions are numbered "1)", "2)" ... and most (not all) are also preceded by "QUESTION n:".
// A new question begins at either marker once the previous one already has its answer.
function splitQuestions(lines) {
  const questions = []
  let current = null
  const isFinished = (block) => block === null || block.some((line) => /\bAns\b/.test(line))

  for (const line of lines) {
    if (/^QUESTION\s*\d+\s*:/i.test(line.trim())) {
      if (isFinished(current)) {
        current = []
        questions.push(current)
      }
      continue
    }
    if (/^\s*\d{1,2}\)/.test(line) && isFinished(current)) {
      current = []
      questions.push(current)
    }
    if (current) {
      current.push(line)
    }
  }
  return questions
}

function parseQuestion(rawLines, id) {
  const lines = rawLines.map(cleanLine).filter((line) => line.length > 0 && !isNoiseLine(line))

  const body = []
  const answerLines = []
  const solutionLines = []
  let answerLetter = ''
  let mode = 'body'

  for (const line of lines) {
    const answerMatch = line.match(/\bAns\.?\s*([A-Ea-e])?\s*=?\s*(.*)$/)
    if (mode !== 'solution' && answerMatch && /^(?:[A-Ea-e][.)]\s*)?Ans\b/.test(line)) {
      // "C. Ans. A= True": a stray option label can precede the answer on the same line.
      const before = line.slice(0, answerMatch.index).trim()
      if (before && !/^[A-Ea-e][.)]$/.test(before)) {
        body.push(before)
      }
      mode = 'answer'
      answerLetter = (answerMatch[1] ?? '').toLowerCase()
      answerLines.push(answerMatch[2])
      continue
    }
    if (/^Solution\s*:/i.test(line)) {
      mode = 'solution'
      solutionLines.push(line.replace(/^Solution\s*:\s*/i, ''))
      continue
    }
    if (mode === 'body') body.push(line)
    else if (mode === 'answer') answerLines.push(line)
    else solutionLines.push(line)
  }

  if (mode === 'body') {
    throw new Error(`${id}: no answer line found`)
  }

  const promptParts = []
  const options = []
  for (const line of body) {
    const optionMatch = line.match(/^([A-Ea-e])[.)]\s*(.*)$/)
    const expected = OPTION_KEYS[options.length]
    if (optionMatch && expected && (options.length > 0 || optionMatch[1].toLowerCase() === 'a')) {
      // Some source lists repeat labels (a, b, a, b); options are always taken in order.
      if (optionMatch[1].toLowerCase() !== expected) {
        warn(`${id}: option label "${optionMatch[1]}" re-keyed as "${expected}"`)
      }
      options.push({ key: expected, text: optionMatch[2].trim() })
      continue
    }
    if (options.length > 0) {
      const last = options[options.length - 1]
      last.text = `${last.text} ${line}`.trim()
    } else {
      promptParts.push(line)
    }
  }

  return {
    prompt: promptParts.join(' ').replace(/^\d{1,2}\)\s*/, '').trim(),
    options,
    answerLetter,
    answerText: cleanLine(answerLines.join(' ')),
    // A watermark fragment can end up glued to the end of the final sentence.
    solution: solutionLines.join(' ').replace(/(?<=\.)\s*(?:N|NP|NPT|NPTE|NPTEL|P|PT|PTE|PTEL|T|TE|TEL|E|EL|L)$/, '').trim(),
  }
}

// The answer is given as a letter, as text, or both. A letter that disagrees with the
// printed answer text is a typo in the source, so the text decides.
function resolveAnswer(parsed, id) {
  const { options } = parsed
  let letter = parsed.answerLetter
  let text = parsed.answerText

  if (!letter && /^[A-Ea-e]\.?$/.test(text)) {
    letter = text[0].toLowerCase()
    text = ''
  }

  const byKey = new Map(options.map((option) => [option.key, option]))
  const wanted = squash(text)
  let matches = wanted ? options.filter((option) => squash(option.text) === wanted) : []

  if (matches.length === 0 && wanted) {
    // Tolerate watermark residue and minor typos in the printed answer text.
    matches = options.filter((option) => {
      const candidate = squash(option.text)
      return candidate.startsWith(wanted) || wanted.startsWith(candidate)
        ? Math.abs(candidate.length - wanted.length) <= 2
        : editDistance(candidate, wanted) <= 2
    })
  }

  if (letter && text) {
    if (matches.length === 1 && matches[0].key === letter) {
      return matches[0]
    }
    if (matches.length === 1) {
      warn(`${id}: answer letter "${letter}" disagrees with answer text "${text}"; used text -> "${matches[0].key}"`)
      return matches[0]
    }
    throw new Error(`${id}: cannot reconcile answer letter "${letter}" with text "${text}"`)
  }

  if (letter) {
    if (!byKey.has(letter)) {
      throw new Error(`${id}: answer letter "${letter}" is not an option`)
    }
    return byKey.get(letter)
  }

  if (matches.length === 1) {
    return matches[0]
  }
  throw new Error(`${id}: could not determine the answer ("${text}")`)
}

function buildQuestion(rawLines, year, week, number) {
  const id = `${year}-W${week}-Q${number}`
  const parsed = parseQuestion(rawLines, id)

  if (parsed.options.length < 2) {
    throw new Error(`${id}: found ${parsed.options.length} options`)
  }

  const answer = resolveAnswer(parsed, id)

  return {
    id,
    prompt: parsed.prompt,
    options: parsed.options,
    correctAnswer: answer.key,
    correctText: answer.text,
    solution: parsed.solution || 'Solution not found in source text.',
    year,
    week,
  }
}

async function readPdfText(pdfPath) {
  const bytes = await fs.readFile(pdfPath)
  const parser = new PDFParse({ data: bytes })
  const result = await parser.getText()
  await parser.destroy()
  return normalizeText(result.text)
}

async function parseYear({ year, pdf, dir }) {
  const pdfPaths = pdf
    ? [path.join(sourceRoot, pdf)]
    : (await fs.readdir(path.join(sourceRoot, dir)))
        .filter((name) => name.toLowerCase().endsWith('.pdf'))
        .sort()
        .map((name) => path.join(sourceRoot, dir, name))

  const byWeek = new Map()

  for (const pdfPath of pdfPaths) {
    const text = await readPdfText(pdfPath)
    for (const section of splitByHeader(text.split('\n'))) {
      if (section.headerYear !== year) {
        warn(`${path.relative(sourceRoot, pdfPath)}: header says ${section.headerYear}, not ${year}; skipped`)
        continue
      }
      if (Number.isNaN(section.week)) {
        throw new Error(`${pdfPath}: could not read the week number`)
      }
      if (byWeek.has(section.week)) {
        throw new Error(`${year}: week ${section.week} appears more than once`)
      }

      const questions = splitQuestions(section.lines).map((block, index) =>
        buildQuestion(block, year, section.week, index + 1),
      )
      byWeek.set(section.week, questions)
    }
  }

  // Weeks supplied only as screenshots are transcribed into <dir>/<folder>/questions.json.
  if (dir) {
    for (const entry of await fs.readdir(path.join(sourceRoot, dir), { withFileTypes: true })) {
      const jsonPath = path.join(sourceRoot, dir, entry.name, 'questions.json')
      if (!entry.isDirectory() || !(await fs.stat(jsonPath).catch(() => null))) {
        continue
      }
      const manual = JSON.parse(await fs.readFile(jsonPath, 'utf8'))
      if (byWeek.has(manual.week)) {
        throw new Error(`${year}: week ${manual.week} appears more than once`)
      }
      byWeek.set(
        manual.week,
        manual.questions.map((item, index) => {
          const id = `${year}-W${manual.week}-Q${index + 1}`
          const options = item.options.map((text, i) => ({ key: OPTION_KEYS[i], text }))
          const answer = options.find((option) => option.key === item.answer)
          if (!answer) {
            throw new Error(`${id}: answer "${item.answer}" is not an option`)
          }
          return {
            id,
            prompt: item.prompt,
            options,
            correctAnswer: answer.key,
            correctText: answer.text,
            solution: 'Solution not found in source text.',
            year,
            week: manual.week,
          }
        }),
      )
    }
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, questions]) => ({ week, questions }))

  return { year, weeks }
}

async function main() {
  const years = []
  for (const source of SOURCES) {
    years.push(await parseYear(source))
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    years,
  }

  const outPath = path.join(root, 'public', 'data', 'quiz-data.json')
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')

  const totals = payload.years.map((year) => ({
    year: year.year,
    weeks: year.weeks.length,
    questions: year.weeks.reduce((sum, week) => sum + week.questions.length, 0),
  }))

  console.log('Created public/data/quiz-data.json')
  console.table(totals)

  if (warnings.length > 0) {
    console.log('\nReview these source irregularities:')
    for (const message of warnings) {
      console.log(` - ${message}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
