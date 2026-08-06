import PrintButton from './PrintButton';
import PageNavigation from './PageNavigation';

export default function PdfToolbar({ page, pageCount, scale, fitMode, user, applications, currentId, hasApplication, readOnly, busy, onPageChange, onScaleChange, onFitMode, onNew, onOpen, onReset, onSave, onSubmit, onGenerate, onPrint, onDownload }) {
  const isManager = user.role === 'manager';
  const runAction = (event) => {
    const action = event.target.value;
    event.target.value = '';
    if (action === 'zoom-out') onScaleChange(Math.max(0.5, scale - 0.1));
    if (action === 'zoom-in') onScaleChange(Math.min(2.5, scale + 0.1));
    if (action === 'fit-width') onFitMode('width');
    if (action === 'fit-page') onFitMode('page');
    if (action === 'new') onNew();
    if (action.startsWith('open:')) onOpen(action.slice(5));
    if (action === 'reset') onReset();
    if (action === 'save') onSave();
    if (action === 'submit') onSubmit();
    if (action === 'generate') onGenerate();
    if (action === 'download') onDownload();
  };

  return <nav className="toolbar" aria-label="PDF controls">
    <PageNavigation page={page} pageCount={pageCount} onChange={onPageChange} />
    <span className="toolbar-divider" />
    <span className="zoom-label">{Math.round(scale * 100)}%</span>
    <select className="toolbar-actions-select" aria-label="PDF and application actions" defaultValue="" disabled={busy} onChange={runAction}>
      <option value="" disabled>Actions</option>
      <optgroup label="View">
        <option value="zoom-out">Zoom Out</option>
        <option value="zoom-in">Zoom In</option>
        <option value="fit-width">Fit Width{fitMode === 'width' ? ' (selected)' : ''}</option>
        <option value="fit-page">Fit Page{fitMode === 'page' ? ' (selected)' : ''}</option>
      </optgroup>
      {!isManager && <optgroup label="My Applications">
        <option value="new">New Application</option>
        {applications.map((application) => <option key={application.id} value={`open:${application.id}`}>
          {application.id === currentId ? 'Current: ' : ''}{application.status === 'submitted' ? 'Submitted' : 'Draft'} - {application.id.slice(0, 8).toUpperCase()}
        </option>)}
      </optgroup>}
      {isManager && <optgroup label="Submitted Applications">
        {applications.length ? applications.map((application) => <option key={application.id} value={`open:${application.id}`}>
          {application.id === currentId ? 'Current: ' : ''}{application.id.slice(0, 8).toUpperCase()} - {application.employeeId}
        </option>) : <option disabled>No submitted applications</option>}
      </optgroup>}
      {!readOnly && <optgroup label="Form">
        <option value="reset">Reset Form</option>
        {!isManager && <option value="save">Save Draft</option>}
        {isManager && hasApplication && <option value="save">Save Changes</option>}
      </optgroup>}
      {isManager && hasApplication && <optgroup label="Manager PDF">
        <option value="generate">Generate PDF</option>
        <option value="download">Download PDF</option>
      </optgroup>}
    </select>
    {isManager && hasApplication && <PrintButton disabled={busy} onClick={onPrint} />}
    {!readOnly && !isManager && (
      <button className="submit-button" type="button" disabled={busy} onClick={onSubmit}>
        Submit Application
      </button>
    )}
  </nav>;
}
