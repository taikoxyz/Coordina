import { useState } from 'react'
import { highlightContent } from '../../lib/highlight'

interface Props {
  content: string
  filePath: string
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  html = html.replace(/^```[\s\S]*?^```/gm, (block) => {
    const inner = block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
    return `<pre class="md-code-block">${inner}</pre>`
  })

  html = html
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="md-ol-item">$2</li>')
    .replace(/^- (.+)$/gm, '<li class="md-ul-item">$1</li>')
    .replace(/\n\n/g, '<br class="md-break"/>')

  return html
}

const isHighlightable = (path: string) =>
  path.endsWith('.json') || path.endsWith('.yaml') || path.endsWith('.yml')

const mdStyles = `
  .md-doc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a2e; line-height: 1.7; font-size: 13.5px; }
  .md-doc .md-h1 { font-size: 1.5rem; font-weight: 700; color: #0f0f23; margin: 0 0 0.25rem 0; padding-bottom: 0.4rem; border-bottom: 2px solid #e8e8f0; letter-spacing: -0.01em; }
  .md-doc .md-h2 { font-size: 1.05rem; font-weight: 600; color: #2d2d5e; margin: 1.25rem 0 0.2rem 0; padding-bottom: 0.2rem; border-bottom: 1px solid #ededf4; }
  .md-doc .md-h3 { font-size: 0.92rem; font-weight: 600; color: #3d3d6b; margin: 1rem 0 0.15rem 0; }
  .md-doc .md-inline-code { background: #f0f0f8; color: #4a4a8a; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.88em; font-family: "SF Mono", Menlo, monospace; }
  .md-doc .md-code-block { background: #f6f6fb; border: 1px solid #e8e8f0; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.82rem; font-family: "SF Mono", Menlo, monospace; color: #2d2d5e; line-height: 1.55; overflow-x: auto; margin: 0.5rem 0; white-space: pre; }
  .md-doc .md-ul-item { margin-left: 1.25rem; list-style-type: disc; color: #2a2a4a; padding: 0.05rem 0; }
  .md-doc .md-ol-item { margin-left: 1.25rem; list-style-type: decimal; color: #2a2a4a; padding: 0.05rem 0; }
  .md-doc .md-break { display: block; content: ""; margin: 0.35rem 0; }
  .md-doc strong { font-weight: 600; color: #0f0f23; }
  .md-doc em { font-style: italic; color: #3d3d6b; }
`

export function MarkdownViewer({ content, filePath }: Props) {
  const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.markdown')
  const [viewSource, setViewSource] = useState(!isMarkdown)

  return (
    <div className="h-full flex flex-col">
      {isMarkdown && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
          <button
            className={`text-xs px-2.5 py-0.5 rounded-md transition-colors ${!viewSource ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setViewSource(false)}
          >
            Preview
          </button>
          <button
            className={`text-xs px-2.5 py-0.5 rounded-md transition-colors ${viewSource ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setViewSource(true)}
          >
            Source
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-5">
        {viewSource || !isMarkdown ? (
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
            {isHighlightable(filePath) ? highlightContent(content, filePath) : content}
          </pre>
        ) : (
          <>
            <style>{mdStyles}</style>
            <div
              className="md-doc max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </>
        )}
      </div>
    </div>
  )
}
