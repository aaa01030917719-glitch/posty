import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

function hasHardBreak(node: ProseMirrorNode) {
  let found = false

  node.forEach((child) => {
    if (child.type.name === 'hardBreak') {
      found = true
    }
  })

  return found
}

function splitParagraphAtHardBreaks(node: ProseMirrorNode) {
  const paragraphs: ProseMirrorNode[] = []
  let lineNodes: ProseMirrorNode[] = []

  const pushParagraph = () => {
    paragraphs.push(node.type.create(node.attrs, lineNodes))
    lineNodes = []
  }

  node.forEach((child) => {
    if (child.type.name === 'hardBreak') {
      pushParagraph()
      return
    }

    lineNodes.push(child)
  })

  pushParagraph()

  return paragraphs
}

export function normalizeSelectedListBlocks(editor: Editor) {
  const { state, view } = editor
  const { selection } = state
  const ranges: Array<{ from: number; to: number; node: ProseMirrorNode }> = []

  if (selection.empty) {
    const { $from } = selection

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth)

      if (node.type.name === 'paragraph' && hasHardBreak(node)) {
        ranges.push({
          from: $from.before(depth),
          to: $from.after(depth),
          node,
        })
        break
      }
    }
  } else {
    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name !== 'paragraph' || !hasHardBreak(node)) return true

      ranges.push({
        from: pos,
        to: pos + node.nodeSize,
        node,
      })

      return false
    })
  }

  if (ranges.length === 0) return false

  const normalizeFrom = ranges[0].from
  const normalizeTo = ranges[ranges.length - 1].to
  let tr = state.tr

  ranges
    .slice()
    .reverse()
    .forEach((range) => {
      tr = tr.replaceWith(range.from, range.to, splitParagraphAtHardBreaks(range.node))
    })

  const mappedFrom = tr.mapping.map(selection.empty ? normalizeFrom : selection.from, -1)
  const mappedTo = tr.mapping.map(selection.empty ? normalizeTo : selection.to, 1)
  const from = Math.min(mappedFrom + 1, tr.doc.content.size)
  const to = Math.max(from, Math.min(mappedTo - 1, tr.doc.content.size))

  tr = tr.setSelection(TextSelection.between(tr.doc.resolve(from), tr.doc.resolve(to), 1))

  view.dispatch(tr)
  return true
}
