import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-gray-900 text-white hover:bg-gray-800',
      outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100',
      ghost: 'text-gray-900 hover:bg-gray-100',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
    }
    
    const sizeClasses = {
      default: 'px-4 py-2.5 text-sm min-h-[44px]',
      sm: 'px-3 py-2 text-xs min-h-[44px]',
      lg: 'px-6 py-3 text-base min-h-[48px]',
    }
    
    return (
      <button
        className={`inline-flex items-center justify-center rounded-md font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

