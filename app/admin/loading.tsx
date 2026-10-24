export default function AdminLoading() {
  return (
    <div className="cms-loading" aria-busy="true" aria-label="Loading admin">
      <div className="cms-loading-bar" />
      <div className="cms-loading-shell">
        <aside className="cms-loading-nav">
          <span />
          <span />
          <span />
          <span />
          <span />
        </aside>
        <main className="cms-loading-main">
          <div className="cms-loading-heading" />
          <div className="cms-loading-stats">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="cms-loading-panel" />
        </main>
      </div>
    </div>
  );
}
