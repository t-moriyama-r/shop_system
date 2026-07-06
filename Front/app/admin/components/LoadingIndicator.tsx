type Props = { message?: string }

export function LoadingIndicator({ message = '読み込み中...' }: Props) {
  return <div className="text-sm text-gray-500">{message}</div>
}
