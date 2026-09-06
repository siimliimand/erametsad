export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-md rounded-input border border-danger bg-dangerLight px-md py-sm text-bodySm font-medium text-danger"
    >
      {message}
    </div>
  )
}
