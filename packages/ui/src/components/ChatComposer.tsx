import React, { useCallback, useState } from 'react'

export interface ChatComposerProps {
  placeholder?: string
  primaryColor: string
  disabled?: boolean
  onSend: (text: string) => void
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  placeholder = 'Nhập tin nhắn...',
  primaryColor,
  disabled = false,
  onSend,
}) => {
  const [value, setValue] = useState('')

  const submit = useCallback(() => {
    const t = value.trim()
    if (!t || disabled) return
    onSend(t)
    setValue('')
  }, [value, disabled, onSend])

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        style={{
          flex: 1,
          resize: 'none',
          padding: '8px 10px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          fontSize: '12px',
          fontFamily: 'inherit',
          outline: 'none',
          minHeight: '40px',
          maxHeight: '96px',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        style={{
          padding: '10px 14px',
          borderRadius: '10px',
          border: 'none',
          backgroundColor: primaryColor,
          color: '#fff',
          fontSize: '12px',
          fontWeight: 600,
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          opacity: disabled || !value.trim() ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        Gửi
      </button>
    </div>
  )
}
