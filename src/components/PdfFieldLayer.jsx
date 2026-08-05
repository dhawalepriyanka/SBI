export default function PdfFieldLayer({ fields, values, onChange, readOnly = false }) {
  return <div className="pdf-field-layer" aria-label="PDF form fields">
    {fields.map((field) => {
      const style = {
        left: `${field.x / 612 * 100}%`,
        top: `${field.y / 841.89 * 100}%`,
        width: `${field.width / 612 * 100}%`,
        height: `${field.height / 841.89 * 100}%`,
        textAlign: field.align || undefined,
      };
      const value = values[field.id] ?? '';
      if (field.type === 'checkbox' || field.type === 'radio') {
        return <button key={field.id} type="button" style={style}
          className={`pdf-control ${field.type} ${value ? 'checked' : ''}`}
          aria-label={`${field.type} ${field.id}`} aria-pressed={Boolean(value)}
          disabled={readOnly} onClick={() => onChange(field.id, value ? '' : '✓')}>{value ? '✓' : ''}</button>;
      }
      if (field.type === 'multiline' || field.type === 'signature') {
        return <textarea key={field.id} style={style} className={`pdf-control ${field.type}`}
          aria-label={`Field ${field.id}`} value={value} disabled={readOnly} spellCheck={false} onChange={(event) => onChange(field.id, event.target.value)} />;
      }
      if (field.type === 'select') {
        return <select key={field.id} style={style} className="pdf-control select"
          aria-label={`Field ${field.id}`} value={value} disabled={readOnly} onChange={(event) => onChange(field.id, event.target.value)}>
          <option value="">SELECT INTEREST TYPE</option>
          {field.options.map((option) => <option key={option} value={option.toUpperCase()}>{option.toUpperCase()}</option>)}
        </select>;
      }
      if (field.type === 'character') {
        const characterValue = String(value).slice(0, field.maxLength);
        const characters = Array.from({ length: field.maxLength }, (_, index) => characterValue[index] || '');
        return <div key={field.id} style={style} className="pdf-character-field"
          onClick={(event) => event.currentTarget.querySelector('input')?.focus()}>
          <div className="pdf-character-display" style={{ gridTemplateColumns: `repeat(${field.maxLength}, 1fr)` }} aria-hidden="true">
            {characters.map((character, index) => <span key={index}>{character}</span>)}
          </div>
          <input className="pdf-character-input" aria-label={`Field ${field.id}`} value={characterValue}
            maxLength={field.maxLength} disabled={readOnly} onChange={(event) => onChange(field.id, event.target.value)} autoComplete="off" />
        </div>;
      }
      return <input key={field.id} style={style} className={`pdf-control ${field.type}`}
        aria-label={`Field ${field.id}`} value={value} maxLength={field.maxLength}
        disabled={readOnly} onChange={(event) => onChange(field.id, event.target.value)} autoComplete="off" spellCheck={false} />;
    })}
  </div>;
}
