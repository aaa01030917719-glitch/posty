type TableRows = string[][]

type TextInsertionResult = {
  value: string
  cursorPosition: number
}

const MIN_TABLE_ROWS = 2
const MIN_TABLE_COLUMNS = 2

function getClipboardValue(clipboardData: DataTransfer, type: string) {
  try {
    return clipboardData.getData(type)
  } catch {
    return ''
  }
}

function normalizeCellText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRows(rows: TableRows): TableRows | null {
  const cleanedRows = rows
    .map((row) => row.map(normalizeCellText))
    .filter((row) => row.some(Boolean))
  const columnCount = Math.max(0, ...cleanedRows.map((row) => row.length))

  if (cleanedRows.length < MIN_TABLE_ROWS || columnCount < MIN_TABLE_COLUMNS) {
    return null
  }

  return cleanedRows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
  )
}

function getCellText(cell: Element) {
  const clone = cell.cloneNode(true) as Element

  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n')
  })

  return clone.textContent ?? ''
}

function getRowsFromHtmlTable(html: string): TableRows | null {
  if (!/<table[\s>]/i.test(html) || typeof DOMParser === 'undefined') {
    return null
  }

  const document = new DOMParser().parseFromString(html, 'text/html')
  const table = document.querySelector('table')

  if (!table) return null

  return normalizeRows(
    Array.from(table.querySelectorAll('tr')).map((row) => {
      return Array.from(row.children)
        .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
        .flatMap((cell) => {
          const columnSpan = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10)
          const span = Number.isFinite(columnSpan) && columnSpan > 1 ? columnSpan : 1

          return [getCellText(cell), ...Array.from({ length: span - 1 }, () => '')]
        })
    })
  )
}

function getRowsFromPlainText(text: string): TableRows | null {
  if (!text.includes('\t')) return null

  return normalizeRows(
    text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.split('\t'))
  )
}

function escapeMarkdownCell(value: string) {
  return value.replace(/\|/g, '\\|')
}

function rowsToMarkdownTable(rows: TableRows) {
  const [header, ...bodyRows] = rows
  const headerLine = `| ${header.map(escapeMarkdownCell).join(' | ')} |`
  const dividerLine = `| ${header.map(() => '---').join(' | ')} |`
  const bodyLines = bodyRows.map(
    (row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`
  )

  return [headerLine, dividerLine, ...bodyLines].join('\n')
}

export function getMarkdownTableFromClipboard(clipboardData: DataTransfer) {
  const htmlRows = getRowsFromHtmlTable(getClipboardValue(clipboardData, 'text/html'))

  if (htmlRows) {
    return rowsToMarkdownTable(htmlRows)
  }

  const plainRows = getRowsFromPlainText(getClipboardValue(clipboardData, 'text/plain'))

  if (plainRows) {
    return rowsToMarkdownTable(plainRows)
  }

  return null
}

export function insertTextAtSelection(
  value: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number
): TextInsertionResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const before = value.slice(0, start)
  const after = value.slice(end)
  const trimmedInsertion = insertion.trim()
  const prefix = before && !before.endsWith('\n') ? '\n' : ''
  const suffix = after && !after.startsWith('\n') ? '\n' : ''
  const nextValue = `${before}${prefix}${trimmedInsertion}${suffix}${after}`

  return {
    value: nextValue,
    cursorPosition: before.length + prefix.length + trimmedInsertion.length,
  }
}
