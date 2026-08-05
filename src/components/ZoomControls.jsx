export default function ZoomControls({ scale, fitMode, onChange, onFit }) {
  return <div className="nav-group">
    <button className="tool-button icon" onClick={() => onChange(Math.max(.5, scale - .15))} aria-label="Zoom Out">−</button>
    <span className="zoom-label">{Math.round(scale * 100)}%</span>
    <button className="tool-button icon" onClick={() => onChange(Math.min(2.5, scale + .15))} aria-label="Zoom In">+</button>
    <button className={fitMode === 'width' ? 'tool-button selected' : 'tool-button'} onClick={() => onFit('width')}>Fit Width</button>
    <button className={fitMode === 'page' ? 'tool-button selected' : 'tool-button'} onClick={() => onFit('page')}>Fit Page</button>
  </div>;
}
