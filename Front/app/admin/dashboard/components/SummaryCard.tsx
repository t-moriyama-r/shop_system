'use client'

export type SummaryCardVariant = 'default' | 'success' | 'warning' | 'danger'

const VALUE_COLOR: Record<SummaryCardVariant, string> = {
  default: 'text-gray-800',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}

export function SummaryCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string | number
  variant?: SummaryCardVariant
}) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${VALUE_COLOR[variant]}`}>{value}</p>
    </div>
  )
}
