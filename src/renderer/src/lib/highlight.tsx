import React from 'react'

export function highlightJson(json: string): React.ReactNode[] {
  const regex = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([:,{}[\]])/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let idx = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(json)) !== null) {
    if (m.index > last) nodes.push(<span key={idx++}>{json.slice(last, m.index)}</span>)
    const [, key, str, keyword, num, punct] = m
    if (key) nodes.push(<span key={idx++} className="text-blue-700">{key}</span>)
    else if (str) nodes.push(<span key={idx++} className="text-green-700">{str}</span>)
    else if (keyword !== undefined) nodes.push(<span key={idx++} className="text-purple-600">{keyword}</span>)
    else if (num !== undefined) nodes.push(<span key={idx++} className="text-amber-600">{num}</span>)
    else if (punct) nodes.push(<span key={idx++} className="text-gray-500">{punct}</span>)
    last = regex.lastIndex
  }
  if (last < json.length) nodes.push(<span key={idx++}>{json.slice(last)}</span>)
  return nodes
}

export function highlightYaml(yaml: string): React.ReactNode[] {
  const regex = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')(?=\s*:)|([\w][\w-]*)(?=\s*:)|(^---$)|("(?:\\.|[^"\\])*"|'[^']*')|\b(true|false|null|yes|no)\b|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/gm
  const nodes: React.ReactNode[] = []
  let last = 0
  let idx = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(yaml)) !== null) {
    if (m.index > last) nodes.push(<span key={idx++}>{yaml.slice(last, m.index)}</span>)
    const [, comment, quotedKey, key, doc, str, bool, num] = m
    if (comment) nodes.push(<span key={idx++} className="text-gray-400 italic">{comment}</span>)
    else if (quotedKey || key) nodes.push(<span key={idx++} className="text-blue-700">{quotedKey ?? key}</span>)
    else if (doc) nodes.push(<span key={idx++} className="text-gray-400">{doc}</span>)
    else if (str) nodes.push(<span key={idx++} className="text-green-700">{str}</span>)
    else if (bool !== undefined) nodes.push(<span key={idx++} className="text-purple-600">{bool}</span>)
    else if (num !== undefined) nodes.push(<span key={idx++} className="text-amber-600">{num}</span>)
    last = regex.lastIndex
  }
  if (last < yaml.length) nodes.push(<span key={idx++}>{yaml.slice(last)}</span>)
  return nodes
}

export function highlightContent(content: string, filePath: string): React.ReactNode {
  if (filePath.endsWith('.json')) return highlightJson(content)
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return highlightYaml(content)
  return content
}
