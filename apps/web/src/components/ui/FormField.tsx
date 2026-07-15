import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const FormField = forwardRef<HTMLInputElement, FieldProps>(function FormField(
  { label, error, hint, id, className = '', ...props },
  ref,
) {
  const fieldId = id ?? props.name
  return (
    <label className="form-field" htmlFor={fieldId}>
      <span className="form-label">{label}</span>
      <input
        ref={ref}
        id={fieldId}
        className={`form-input ${error ? 'form-input-error' : ''} ${className}`.trim()}
        {...props}
      />
      {error ? (
        <span className="form-error">{error}</span>
      ) : hint ? (
        <span className="form-hint">{hint}</span>
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
  function TextAreaField({ label, error, hint, id, className = '', ...props }, ref) {
    const fieldId = id ?? props.name
    return (
      <label className="form-field" htmlFor={fieldId}>
        <span className="form-label">{label}</span>
        <textarea
          ref={ref}
          id={fieldId}
          className={`form-input form-textarea ${error ? 'form-input-error' : ''} ${className}`.trim()}
          {...props}
        />
        {error ? (
          <span className="form-error">{error}</span>
        ) : hint ? (
          <span className="form-hint">{hint}</span>
        ) : null}
      </label>
    )
  },
)
