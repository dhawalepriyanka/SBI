export default function ImagePreviewModal({ title, src, kind, onConfirm, onCancel }) {
  return <div className="modal-backdrop" role="presentation">
    <section className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div className="modal-heading"><div><p className="eyebrow">Preview</p><h2 id="preview-title">{title}</h2></div><button className="modal-close" onClick={onCancel} aria-label="Close">×</button></div>
      <div className={`image-preview ${kind}`}><img src={src} alt={`${title} preview`} /></div>
      <div className="modal-actions"><button className="tool-button" onClick={onCancel}>Cancel</button><button className="print-button" onClick={onConfirm}>Use Image</button></div>
    </section>
  </div>;
}
