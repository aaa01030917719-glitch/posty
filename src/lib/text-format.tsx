type TextBlock =
  | {
      type: 'text'
      value: string
    }
  | {
      type: 'table'
      header: string[]
      rows: string[][]
    }

type FormattedTextProps = {
  text: string
  className?: string
}

function splitMarkdownRow(line: string) {
  let source = line.trim()

  if (source.startsWith('|')) {
    source = source.slice(1)
  }

  if (source.endsWith('|') && !source.endsWith('\\|')) {
    source = source.slice(0, -1)
  }

  const cells: string[] = []
  let current = ''

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const nextChar = source[index + 1]

    if (char === '\\' && nextChar === '|') {
      current += '|'
      index += 1
      continue
    }

    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())

  return cells
}

function isSeparatorLine(line: string) {
  const cells = splitMarkdownRow(line)

  return (
    cells.length >= 2 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))
  )
}

function isTableStart(currentLine: string, nextLine: string | undefined) {
  if (!nextLine || !currentLine.includes('|')) return false

  return splitMarkdownRow(currentLine).length >= 2 && isSeparatorLine(nextLine)
}

function normalizeRowLength(row: string[], length: number) {
  return Array.from({ length }, (_, index) => row[index] ?? '')
}

function parseFormattedText(text: string): TextBlock[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocks: TextBlock[] = []
  const textLines: string[] = []

  const flushText = () => {
    const value = textLines.join('\n').replace(/^\n+|\n+$/g, '')

    if (value) {
      blocks.push({ type: 'text', value })
    }

    textLines.length = 0
  }

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]
    const nextLine = lines[index + 1]

    if (isTableStart(line, nextLine)) {
      flushText()

      const header = splitMarkdownRow(line)
      const columnCount = header.length
      const rows: string[][] = []

      index += 2

      while (index < lines.length) {
        const rowLine = lines[index]

        if (!rowLine.trim() || !rowLine.includes('|')) break

        const row = splitMarkdownRow(rowLine)

        if (row.length < 2) break

        rows.push(normalizeRowLength(row, columnCount))
        index += 1
      }

      blocks.push({
        type: 'table',
        header,
        rows,
      })
      continue
    }

    textLines.push(line)
    index += 1
  }

  flushText()

  return blocks
}

export function FormattedText({ text, className }: FormattedTextProps) {
  const blocks = parseFormattedText(text)

  if (blocks.length === 0) return null

  return (
    <div className={['space-y-3', className].filter(Boolean).join(' ')}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <div key={`text-${index}`} className="whitespace-pre-wrap">
              {block.value}
            </div>
          )
        }

        return (
          <div
            key={`table-${index}`}
            className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-soft)]"
          >
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]">
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th
                      key={`head-${cellIndex}`}
                      scope="col"
                      className="border-b border-r border-[var(--color-border-soft)] px-3 py-2 font-semibold last:border-r-0"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--color-text-body)]">
                {block.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`cell-${rowIndex}-${cellIndex}`}
                        className="border-r border-t border-[var(--color-border-soft)] px-3 py-2 align-top last:border-r-0"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
