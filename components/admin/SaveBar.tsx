export function SaveBar({
  dirty,
  message,
  children,
}: {
  dirty: boolean;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cms-savebar" data-dirty={dirty}>
      <p>
        <i aria-hidden="true" />
        {message}
      </p>
      <div className="cms-actions">{children}</div>
    </div>
  );
}
