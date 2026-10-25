export default function AdminLoading() {
  return (
    <div className="cms-loading" aria-busy="true" aria-label="Loading admin">
      <div className="cms-loading-nav" />
      <div className="cms-loading-main">
        <span className="cms-loading-heading" />
        <div className="cms-loading-stats">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="cms-loading-panel" />
      </div>
    </div>
  );
}
