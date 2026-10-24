export default function AccountLoading() {
  return (
    <main className="account-content account-loading" aria-busy="true" aria-label="Loading account">
      <header className="account-page-header">
        <span className="account-loading-line account-loading-eyebrow" />
        <span className="account-loading-line account-loading-title" />
        <span className="account-loading-line account-loading-subtitle" />
      </header>
      <div className="account-loading-stats" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="account-loading-panel" aria-hidden="true" />
    </main>
  );
}
