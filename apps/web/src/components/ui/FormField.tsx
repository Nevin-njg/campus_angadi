import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const FormField = forwardRef<HTMLInputElement, FieldProps>(function FormField(
  { label, error, hint, id, className = '', 'aria-describedby': describedBy, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? props.name ?? generatedId
  const messageId = `${fieldId}-message`
  const description = [describedBy, error || hint ? messageId : null].filter(Boolean).join(' ')
  return (
    <label className="form-field" htmlFor={fieldId}>
      <span className="form-label">{label}</span>
      <input
        ref={ref}
        id={fieldId}
        className={`form-input ${error ? 'form-input-error' : ''} ${className}`.trim()}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={description || undefined}
      />
      {error ? (
        <span className="form-error" id={messageId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="form-hint" id={messageId}>
          {hint}
        </span>
      ) : null}
    </label>
  )
})

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    { label, error, hint, id, className = '', 'aria-describedby': describedBy, ...props },
    ref,
  ) {
    const generatedId = useId()
    const fieldId = id ?? props.name ?? generatedId
    const messageId = `${fieldId}-message`
    const description = [describedBy, error || hint ? messageId : null].filter(Boolean).join(' ')
    return (
      <label className="form-field" htmlFor={fieldId}>
        <span className="form-label">{label}</span>
        <textarea
          ref={ref}
          id={fieldId}
          className={`form-input form-textarea ${error ? 'form-input-error' : ''} ${className}`.trim()}
          {...props}
          aria-invalid={error ? true : undefined}
          aria-describedby={description || undefined}
        />
        {error ? (
          <span className="form-error" id={messageId} role="alert">
            {error}
          </span>
        ) : hint ? (
          <span className="form-hint" id={messageId}>
            {hint}
          </span>
        ) : null}
      </label>
    )
  },
)
