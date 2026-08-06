import { useRef, useState } from 'react';

function CharacterField({ field, value, style, readOnly, onChange }) {
  const inputRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(null);

  const rawString = String(value || '');
  const characters = Array.from({ length: field.maxLength }, (_, index) => rawString[index] || '');

  const commitCharacters = (newChars) => {
    const result = newChars.join('');
    const trimmed = result.replace(/\s+$/, '');
    onChange(field.id, trimmed);
  };

  const handleCellClick = (cellIndex) => {
    if (readOnly) return;
    const target = Math.min(cellIndex, field.maxLength - 1);
    setFocusedIndex(target);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (readOnly || focusedIndex === null) return;
    const idx = focusedIndex;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setFocusedIndex(Math.max(0, idx - 1));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setFocusedIndex(Math.min(field.maxLength - 1, idx + 1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setFocusedIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      let last = field.maxLength - 1;
      while (last > 0 && !characters[last]) last--;
      setFocusedIndex(last);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      const newChars = [...characters];
      if (newChars[idx]) {
        newChars[idx] = '';
        commitCharacters(newChars);
      } else if (idx > 0) {
        const prevIdx = idx - 1;
        newChars[prevIdx] = '';
        commitCharacters(newChars);
        setFocusedIndex(prevIdx);
      }
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      if (characters[idx]) {
        const newChars = [...characters];
        newChars[idx] = '';
        commitCharacters(newChars);
      }
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      const char = event.key.toUpperCase();
      const newChars = [...characters];
      newChars[idx] = char;
      commitCharacters(newChars);
      if (idx < field.maxLength - 1) {
        setFocusedIndex(idx + 1);
      }
      return;
    }
  };

  const handlePaste = (event) => {
    if (readOnly || focusedIndex === null) return;
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!pasted) return;
    const newChars = [...characters];
    let curr = focusedIndex;
    for (let i = 0; i < pasted.length && curr < field.maxLength; i++) {
      newChars[curr] = pasted[i];
      curr++;
    }
    commitCharacters(newChars);
    setFocusedIndex(Math.min(field.maxLength - 1, curr));
  };

  const handleContainerClick = (event) => {
    if (readOnly) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    if (rect.width <= 0) return;
    const cellWidth = rect.width / field.maxLength;
    const clickedIndex = Math.min(field.maxLength - 1, Math.max(0, Math.floor(clickX / cellWidth)));
    setFocusedIndex(clickedIndex);
    inputRef.current?.focus();
  };

  return <div style={style} className="pdf-character-field" onClick={handleContainerClick}>
    <div className="pdf-character-display" style={{ gridTemplateColumns: `repeat(${field.maxLength}, 1fr)` }} aria-hidden="true">
      {characters.map((character, index) => (
        <span
          key={index}
          className={index === focusedIndex ? 'active-cell' : ''}
        >
          {character}
        </span>
      ))}
    </div>
    <input
      ref={inputRef}
      className="pdf-character-input"
      aria-label={`Field ${field.id}`}
      value={characters.join('')}
      maxLength={field.maxLength}
      disabled={readOnly}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onClick={handleContainerClick}
      onFocus={() => {
        if (focusedIndex === null) {
          let firstEmpty = characters.findIndex((char) => !char);
          if (firstEmpty === -1) firstEmpty = 0;
          setFocusedIndex(firstEmpty);
        }
      }}
      onBlur={() => setFocusedIndex(null)}
      onChange={() => {}}
      autoComplete="off"
    />
  </div>;
}

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
        return <CharacterField key={field.id} field={field} value={value} style={style} readOnly={readOnly} onChange={onChange} />;
      }
      return <input key={field.id} style={style} className={`pdf-control ${field.type}`}
        aria-label={`Field ${field.id}`} value={value} maxLength={field.maxLength}
        disabled={readOnly} onChange={(event) => onChange(field.id, event.target.value)} autoComplete="off" spellCheck={false} />;
    })}
  </div>;
}
