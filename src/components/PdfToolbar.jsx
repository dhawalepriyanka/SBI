import PrintButton from './PrintButton';
import PageNavigation from './PageNavigation';
import { useState } from 'react';

export default function PdfToolbar({ page, pageCount, scale, fitMode, user, applications, currentId, hasApplication, readOnly, busy, dateFilters, onDateFiltersChange, onPageChange, onScaleChange, onFitMode, onNew, onOpen, onReset, onSave, onSubmit, onDelete, onGenerate, onPrint, onDownload }) {
  const isManager = user.role === 'manager';
  const [actionsOpen, setActionsOpen] = useState(false);
  const runAction = (action) => {
    setActionsOpen(false);
    if (action === 'zoom-out') onScaleChange(Math.max(0.5, scale - 0.1));
    if (action === 'zoom-in') onScaleChange(Math.min(2.5, scale + 0.1));
    if (action === 'fit-width') onFitMode('width');
    if (action === 'fit-page') onFitMode('page');
    if (action === 'new') onNew();
    if (action.startsWith('open:')) onOpen(action.slice(5));
    if (action === 'reset') onReset();
    if (action === 'save') onSave();
    if (action === 'submit') onSubmit();
    if (action === 'delete') onDelete();
    if (action === 'generate') onGenerate();
    if (action === 'download') onDownload();
  };

  return <nav className="toolbar" aria-label="PDF controls">
    <PageNavigation page={page} pageCount={pageCount} onChange={onPageChange} />
    {isManager && <div className="manager-date-filters" aria-label="Filter submitted applications by date">
      <label>Date <input type="date" value={dateFilters.date} onChange={(event) => onDateFiltersChange({ date: event.target.value })} /></label>
      {dateFilters.date && <button type="button" className="date-filter-clear" onClick={() => onDateFiltersChange({ date: '' })}>Clear</button>}
    </div>}
    {(!isManager || hasApplication) && <div className="action-menu">
      <button type="button" className="action-menu-trigger" disabled={busy} aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)}>Actions <span>⌄</span></button>
      {actionsOpen && <div className="action-menu-panel" role="menu">
        {!isManager && <><p>My applications</p><button type="button" role="menuitem" onClick={() => runAction('new')}>New application</button>{applications.map((application) => <button key={application.id} type="button" role="menuitem" onClick={() => runAction(`open:${application.id}`)}>{application.status === 'submitted' ? 'Submitted' : 'Draft'} · {application.id.slice(0, 8).toUpperCase()}</button>)}</>}
        {!readOnly && <><p>{isManager ? 'Form' : 'Form actions'}</p>{isManager && hasApplication && <button type="button" role="menuitem" onClick={() => runAction('save')}>Save changes</button>}<button type="button" role="menuitem" onClick={() => runAction('reset')}>Reset form</button></>}
        {isManager && hasApplication && <><p>PDF</p><button type="button" role="menuitem" onClick={() => runAction('generate')}>Generate PDF</button><button type="button" role="menuitem" onClick={() => runAction('download')}>Download PDF</button></>}
      </div>}
    </div>}
    <div className="toolbar-end-actions">
      {hasApplication && (
        <button className="delete-button" type="button" disabled={busy} onClick={onDelete}>
          Delete Application
        </button>
      )}
      {isManager && hasApplication && <PrintButton disabled={busy} onClick={onPrint} />}
      {!readOnly && !isManager && (
        <button className="submit-button" type="button" disabled={busy} onClick={onSubmit}>
          Submit Application
        </button>
      )}
    </div>
  </nav>;
}
