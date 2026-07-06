'use client'

import type { UseFormRegisterReturn } from 'react-hook-form'

type Props = {
  id: string
  label: string
  registration: UseFormRegisterReturn
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  error?: string
  required?: boolean
}

export function TextField({
  id,
  label,
  registration,
  type = 'text',
  placeholder,
  error,
  required,
}: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
        {...registration}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
