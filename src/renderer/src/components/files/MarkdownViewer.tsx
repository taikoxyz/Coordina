import { useState } from 'react'

interface Props {
  content: string
  filePath: string
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-4 mb-2">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-gray-900 mt-3 mb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-medium text-gray-800 mt-2 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm font-mono text-blue-700">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-gray-700 mb-2">')
    .replace(/\n/g, '<br/>')
}

export function MarkdownViewer({ content, filePath }: Props) {
  const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.markdown')
  const [viewSource, setViewSource] = useState(!isMarkdown)

  return (
    <div className="h-full flex flex-col">
      {isMarkdown && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            className={`text-xs px-2 py-0.5 rounded ${!viewSource ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewSource(false)}
          >
            Preview
          </button>
          <button
            className={`text-xs px-2 py-0.5 rounded ${viewSource ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewSource(true)}
          >
            Source
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {viewSource ? (
          <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</pre>
        ) : (
          <div
            className="prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: `<p class="text-gray-700 mb-2">${renderMarkdown(content)}</p>` }}
          />
        )}
      </div>
    </div>
  )
}
