type Props = { message: string }

export function ErrorMessage({ message }: Props) {
  return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</div>
}
