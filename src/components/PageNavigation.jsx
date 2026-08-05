export default function PageNavigation({ page, pageCount, onChange }) {
  return <div className="nav-group">
    <button className="tool-button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous Page">‹ <span>Previous Page</span></button>
    <span className="page-count">{page} / {pageCount || '–'}</span>
    <button className="tool-button" disabled={!pageCount || page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Next Page"><span>Next Page</span> ›</button>
  </div>;
}
