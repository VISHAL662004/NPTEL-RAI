import type { Question } from '../types/quiz'

export function QuestionTable({ table }: { table: NonNullable<Question['table']> }) {
  return (
    <div className="question-table-wrap">
      <table className="question-table">
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
