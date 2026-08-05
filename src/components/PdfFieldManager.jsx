import { useEffect, useState } from 'react';

// Keeps AcroForm discovery separate from rendering. PDF.js owns the native
// annotation widgets so their bounds remain those embedded in the official PDF.
export default function PdfFieldManager({ form }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    if (!form) return;
    const fields = form.getFields();
    setSummary({ total: fields.length, required: fields.filter((field) => field.isRequired()).length });
  }, [form]);
  if (!summary) return null;
  if (!summary.total) return <p className="field-notice neutral">Click a printed box to enter a value. The coordinate layer does not change the official PDF artwork.</p>;
  return summary.required ? <p className="field-notice">{summary.required} required PDF field{summary.required === 1 ? '' : 's'} marked by the official form.</p> : null;
}
