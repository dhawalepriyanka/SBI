import { useRef, useState } from 'react';

function CharacterField({ field, value, style, readOnly, onChange }) {
  const inputRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(null);

  const rawString = String(value || '');
  const characterValue = rawString.slice(0, field.maxLength);
  const characters = Array.from({ length: field.maxLength }, (_, index) => characterValue[index] || '');
  const cellCount = Math.max(1, field.maxLength);
  const useFixedCells = Number.isFinite(field.boxWidth) && field.boxWidth > 0;

  const handleContainerClick = (event) => {
    if (readOnly) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const padding = field.touchPadding || 0;
    const clickX = event.clientX - rect.left - padding;
    const visualWidth = rect.width - padding * 2;
    if (visualWidth <= 0) return;
    const cellWidth = visualWidth / field.maxLength;
    const clickedIndex = Math.min(field.maxLength - 1, Math.max(0, Math.floor(clickX / cellWidth)));
    setFocusedIndex(clickedIndex);
    inputRef.current?.focus();
  };

  const handleInputChange = (event) => {
    if (readOnly) return;
    const rawVal = event.target.value.toUpperCase();

    if (focusedIndex !== null && focusedIndex < characterValue.length && rawVal.length > characterValue.length) {
      const typedChar = rawVal.slice(-1) || rawVal[focusedIndex] || '';
      const updated = (characterValue.slice(0, focusedIndex) + typedChar + characterValue.slice(focusedIndex + 1)).slice(0, field.maxLength);
      onChange(field.id, updated);
      setFocusedIndex(Math.min(field.maxLength - 1, focusedIndex + 1));
      return;
    }

    const clean = rawVal.slice(0, field.maxLength);
    onChange(field.id, clean);
    setFocusedIndex(Math.min(field.maxLength - 1, clean.length));
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
      setFocusedIndex(Math.min(field.maxLength - 1, characterValue.length));
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (characters[idx]) {
        const updated = characterValue.slice(0, idx) + characterValue.slice(idx + 1);
        onChange(field.id, updated);
      } else if (idx > 0) {
        const prevIdx = idx - 1;
        const updated = characterValue.slice(0, prevIdx) + characterValue.slice(prevIdx + 1);
        onChange(field.id, updated);
        setFocusedIndex(prevIdx);
      }
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      if (characters[idx]) {
        const updated = characterValue.slice(0, idx) + characterValue.slice(idx + 1);
        onChange(field.id, updated);
      }
      return;
    }
  };

  const handlePaste = (event) => {
    if (readOnly) return;
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!pasted) return;
    const pos = focusedIndex ?? characterValue.length;
    const updated = (characterValue.slice(0, pos) + pasted + characterValue.slice(pos + pasted.length)).slice(0, field.maxLength);
    onChange(field.id, updated);
    setFocusedIndex(Math.min(field.maxLength - 1, pos + pasted.length));
  };

  const activeIndex = focusedIndex !== null ? focusedIndex : Math.min(characterValue.length, field.maxLength - 1);

  const touchPadding = field.touchPadding || 0;
  const visualStyle = {
    gridTemplateColumns: `repeat(${cellCount}, minmax(0, 1fr))`,
    inset: touchPadding ? `${touchPadding}px` : undefined,
    '--character-font-size': field.characterFontSize || undefined,
    '--character-offset-y': field.characterOffsetY || '0%',
  };

  return <div style={style} className="pdf-character-field" onClick={handleContainerClick}>
    <div className={`pdf-character-display ${useFixedCells ? 'fixed-character-cells' : ''}`} style={visualStyle} aria-hidden="true">
      {characters.map((character, index) => (
        <span
          key={index}
          className={index === activeIndex ? 'active-cell' : ''}
          style={useFixedCells ? {
            left: `${index * field.boxWidth / field.width * 100}%`,
            width: `${field.boxWidth / field.width * 100}%`,
          } : undefined}
        >
          {character}
        </span>
      ))}
    </div>
    <input
      ref={inputRef}
      className="pdf-character-input"
      aria-label={`Field ${field.id}`}
      value={characterValue}
      maxLength={field.maxLength}
      disabled={readOnly}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onClick={handleContainerClick}
      onFocus={() => {
        if (focusedIndex === null) {
          setFocusedIndex(Math.min(characterValue.length, field.maxLength - 1));
        }
      }}
      onBlur={() => setFocusedIndex(null)}
      onChange={handleInputChange}
      autoComplete="off"
    />
  </div>;
}

export default function PdfFieldLayer({ fields, values, onChange, readOnly = false }) {
  return <div className="pdf-field-layer" aria-label="PDF form fields">
    {fields.map((field) => {
      const style = {
        left: field.touchPadding ? `calc(${field.x / 612 * 100}% - ${field.touchPadding}px)` : `${field.x / 612 * 100}%`,
        top: field.touchPadding ? `calc(${field.y / 841.89 * 100}% - ${field.touchPadding}px)` : `${field.y / 841.89 * 100}%`,
        width: field.touchPadding ? `calc(${field.width / 612 * 100}% + ${field.touchPadding * 2}px)` : `${field.width / 612 * 100}%`,
        height: field.touchPadding ? `calc(${field.height / 841.89 * 100}% + ${field.touchPadding * 2}px)` : `${field.height / 841.89 * 100}%`,
        textAlign: field.align || undefined,
        zIndex: field.zIndex || undefined,
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
