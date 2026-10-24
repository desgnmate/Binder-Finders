export default function AccountLoading() {
  return (
    <div className="ac-panel ac-panel--red ac-loading" role="status" aria-busy="true" aria-label="Loading account">
      <span className="ac-loading__lights" />
      <div className="ac-loading__hub" aria-hidden="true">
        <span />
        <span />
      </div>
    </div>
  );
}
