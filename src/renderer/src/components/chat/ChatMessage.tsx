import type { ChatMessage as ChatMessageType } from '../../hooks/useGatewayChat'

interface Props {
  message: ChatMessageType
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold mr-3 flex-shrink-0 mt-1">
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm'
        }`}
      >
        {message.content}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((file) => (
              <div key={`${file.name}-${file.size}`} className={`text-xs rounded px-2 py-1 ${isUser ? 'bg-blue-700/70 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {file.name}
              </div>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold ml-3 flex-shrink-0 mt-1">
          You
        </div>
      )}
    </div>
  )
}
