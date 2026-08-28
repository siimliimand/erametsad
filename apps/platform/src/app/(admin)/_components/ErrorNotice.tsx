export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-md rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger"
    >
      {message}
    </div>
  )
}
