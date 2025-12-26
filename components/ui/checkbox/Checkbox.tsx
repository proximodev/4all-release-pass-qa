import { InputHTMLAttributes, forwardRef } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`

    return (
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-center gap-2 cursor-pointer select-none ${className}`}
      >
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className="w-4 h-4 accent-brand-cyan cursor-pointer"
          {...props}
        />
        <span className="text-sm text-black">{label}</span>
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
