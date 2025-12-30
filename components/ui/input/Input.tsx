import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-black mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 border border-medium-gray rounded focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent ${
            error ? 'border-red' : ''
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="error">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
