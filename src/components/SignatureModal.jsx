import { useEffect, useRef } from 'react';

export default function SignatureModal({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const snapshot = canvas.toDataURL();
      const ratio = Math.max(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext('2d');
      context.scale(ratio, ratio);
      context.lineWidth = 2.2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#07121e';
      if (snapshot.length > 100) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
        image.src = snapshot;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = point(event);
  };
  const move = (event) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [event.nativeEvent];
    events.forEach((currentEvent) => {
      const next = point(currentEvent);
      context.beginPath();
      context.moveTo(lastPoint.current.x, lastPoint.current.y);
      context.lineTo(next.x, next.y);
      context.stroke();
      lastPoint.current = next;
    });
  };
  const stop = () => { drawing.current = false; lastPoint.current = null; };
  const save = () => onSave(canvasRef.current.toDataURL('image/png'));

  return <div className="modal-backdrop" role="presentation">
    <section className="signature-modal" role="dialog" aria-modal="true" aria-labelledby="signature-title">
      <div className="modal-heading"><div><p className="eyebrow">Digital signature</p><h2 id="signature-title">Draw Signature</h2></div><button className="modal-close" onClick={onCancel} aria-label="Close">×</button></div>
      <p className="modal-help">Sign inside the area using a mouse, finger, or stylus.</p>
      <canvas ref={canvasRef} className="signature-canvas" onPointerDown={start} onPointerMove={move}
        onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop} />
      <div className="modal-actions"><button className="tool-button" onClick={onCancel}>Cancel</button><button className="tool-button" onClick={clear}>Clear</button><button className="print-button" onClick={save}>Save</button></div>
    </section>
  </div>;
}
