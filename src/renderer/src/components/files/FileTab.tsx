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
      className={`flex items-center gap-2 px-3 py-1.5 text-xs border-r border-gray-200 flex-shrink-0 group relative ${
        isActive
          ? 'bg-white text-gray-900'
          : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
      onClick={onClick}
    >
      <span className="max-w-32 truncate">{name}</span>
      <span
        role="button"
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 leading-none"
        onClick={e => { e.stopPropagation(); onClose() }}
      >
        ✕
      </span>
      {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
    </button>
  )
}
