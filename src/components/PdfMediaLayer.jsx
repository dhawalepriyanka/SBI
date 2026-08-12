import { useRef } from 'react';
import { imagePlacementMap } from '../imagePlacementMap';

const acceptedImageTypes = 'image/png,image/jpeg,.png,.jpg,.jpeg';

function MediaSlot({ item, src, onSelect, onDraw }) {
  const inputRef = useRef(null);

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const extensionIsValid = /\.(png|jpe?g)$/i.test(file.name);
    if (!['image/png', 'image/jpeg'].includes(file.type) && !extensionIsValid) return;

    const reader = new FileReader();
    reader.onload = () => onSelect(item.id, reader.result);
    reader.readAsDataURL(file);
  };

  const style = {
    left: `${item.x / 612 * 100}%`,
    top: `${item.y / 841.89 * 100}%`,
    width: `${item.width / 612 * 100}%`,
    height: `${item.height / 841.89 * 100}%`,
  };

  return <div className={`pdf-media-slot ${item.kind}-slot placement-${item.id}${src ? ' has-media' : ''}`} data-placement-id={item.id} style={style}>
    {src && <img src={src} alt={item.kind === 'photo' ? 'Uploaded photo' : 'Digital signature'} className={`pdf-media ${item.kind}`} />}
    <input ref={inputRef} className="visually-hidden" type="file" accept={acceptedImageTypes} onChange={chooseImage} />
    <div className="media-box-actions">
      {item.kind === 'signature' && <button type="button" className="media-box-action" onClick={() => onDraw(item.id)}>
        {src ? 'Redraw' : (item.id === 'signature-p24-office' ? 'Draw' : 'Draw Signature')}
      </button>}
      <button type="button" className="media-box-action" onClick={() => inputRef.current?.click()}>
        {item.kind === 'photo' ? (src ? 'Replace Photo' : 'Upload Photo') : (src ? 'Replace' : (item.id === 'signature-p24-office' ? 'Upload' : 'Upload Signature'))}
      </button>
    </div>
  </div>;
}

export default function PdfMediaLayer({ pageNumber, photo, signature, onPhotoSelected, onSignatureSelected, onDrawSignature, readOnly = false }) {
  const items = [
    ...imagePlacementMap.photo.filter((item) => item.page === pageNumber).map((item) => ({ ...item, src: photo[item.id], kind: 'photo', onSelect: onPhotoSelected })),
    ...imagePlacementMap.signature.filter((item) => item.page === pageNumber).map((item) => ({ ...item, src: signature[item.id], kind: 'signature', onSelect: onSignatureSelected })),
  ];

  if (!items.length) return null;
  return <div className="pdf-media-layer" aria-label="Photo and signature placements">
    {items.map((item) => readOnly ? <div key={item.id} className={`pdf-media-slot ${item.kind}-slot has-media`} style={{
      left: `${item.x / 612 * 100}%`, top: `${item.y / 841.89 * 100}%`, width: `${item.width / 612 * 100}%`, height: `${item.height / 841.89 * 100}%`,
    }}>{item.src && <img src={item.src} alt="" className={`pdf-media ${item.kind}`} />}</div> : <MediaSlot key={item.id} item={item} src={item.src}
      onSelect={item.onSelect} onDraw={onDrawSignature} />)}
  </div>;
}
