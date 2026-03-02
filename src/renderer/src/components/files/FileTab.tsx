interface Props {
  path: string
  isActive: boolean
  onClick: () => void
  onClose: () => void
}

export function FileTab({ path, isActive, onClick, onClose }: Props) {
  const name = path.split('/').pop() ?? path

  return (
    <button
      className={`flex items-center gap-2 px-3 py-1.5 text-xs border-r border-gray-700 flex-shrink-0 group ${
        isActive
          ? 'bg-gray-900 text-white border-b-2 border-b-blue-500'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
      }`}
      onClick={onClick}
    >
      <span className="max-w-32 truncate">{name}</span>
      <span
        role="button"
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white leading-none"
        onClick={e => { e.stopPropagation(); onClose() }}
      >
        ✕
      </span>
    </button>
  )
}
