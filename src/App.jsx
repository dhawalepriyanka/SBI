import { useCallback, useEffect, useMemo, useState } from 'react';
import PdfToolbar from './components/PdfToolbar';
import PdfViewer from './components/PdfViewer';
import LoginPage from './components/LoginPage';
import baseFieldMap from './fieldMap.json';
import SignatureModal from './components/SignatureModal';
import ImagePreviewModal from './components/ImagePreviewModal';
import { addressSyncSections } from './addressSyncMap';
import { addClickableTables } from './tableFieldMap';
import { apiRequest, pdfRequest } from './api';

const fieldMap = addClickableTables(baseFieldMap);
const managerMode = window.location.pathname === '/manager';
const uppercaseFieldValues = (storedValues = {}) => {
  const normalized = Object.fromEntries(
    Object.entries(storedValues).map(([id, value]) => [id, typeof value === 'string'
      ? value.toUpperCase()
      : value]),
  );
  [6, 10].forEach((pageNumber) => {
    for (let row = 1; row <= 5; row += 1) {
      const amountId = `p${pageNumber}_opinion_r${row}_amount`;
      const firstLegacyId = `p${pageNumber}_opinion_r${row}_c3`;
      const secondLegacyId = `p${pageNumber}_opinion_r${row}_c4`;
      if (!normalized[amountId]) normalized[amountId] = normalized[secondLegacyId] || normalized[firstLegacyId] || '';
      delete normalized[firstLegacyId];
      delete normalized[secondLegacyId];
    }
  });
  return normalized;
};

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [current, setCurrent] = useState(null);
  const [pageCount, setPageCount] = useState(24);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [fitMode, setFitMode] = useState('width');
  const [rotation, setRotation] = useState(0);
  const [values, setValues] = useState({});
  const [photo, setPhoto] = useState({});
  const [signature, setSignature] = useState({});
  const [drawingSignature, setDrawingSignature] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [startupError, setStartupError] = useState('');

  const loadApplications = useCallback(async () => {
    const result = await apiRequest('/api/applications');
    setApplications(result.applications);
    return result.applications;
  }, []);

  const initializeSession = useCallback(async () => {
    setSessionLoading(true);
    setStartupError('');
    try {
      let activeUser;
      try {
        ({ user: activeUser } = await apiRequest('/api/session'));
      } catch (error) {
        if (error.status !== 401) throw error;
        if (managerMode) {
          setUser(null);
          return;
        }
        ({ user: activeUser } = await apiRequest('/api/auth/employee-session', { method: 'POST' }));
      }

      if (managerMode && activeUser.role !== 'manager') {
        setUser(null);
        return;
      }

      setUser(activeUser);
      await loadApplications();
    } catch (error) {
      setUser(null);
      setStartupError(error.message || 'Unable to open the application.');
    } finally {
      setSessionLoading(false);
    }
  }, [loadApplications]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const formData = useMemo(() => ({ values: uppercaseFieldValues(values), photo, signature }), [photo, signature, values]);
  const readOnly = Boolean(current && ((user?.role === 'employee' && current.status === 'submitted') || (user?.role === 'manager' && !user.canEdit)));

  const clearForm = useCallback(() => {
    setValues({});
    setPhoto({});
    setSignature({});
    setPage(1);
    setRotation(0);
    setMessage('');
  }, []);

  const newApplication = useCallback(() => {
    setCurrent(null);
    clearForm();
  }, [clearForm]);

  const openApplication = useCallback(async (id) => {
    setBusy(true);
    setMessage('');
    try {
      const { application } = await apiRequest(`/api/applications/${id}`);
      setCurrent(application);
      setValues(uppercaseFieldValues(application.formData.values));
      setPhoto(application.formData.photo || {});
      setSignature(application.formData.signature || {});
      setPage(1);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const saveApplication = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = current
        ? await apiRequest(`/api/applications/${current.id}`, { method: 'PUT', body: JSON.stringify({ formData }) })
        : await apiRequest('/api/applications', { method: 'POST', body: JSON.stringify({ formData }) });
      setCurrent(result.application);
      await loadApplications();
      setMessage(user.role === 'manager' ? 'Application changes saved.' : 'Draft saved.');
      return result.application;
    } catch (error) {
      setMessage(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [current, formData, loadApplications, user]);

  const submitApplication = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      let application = current;
      if (!application) {
        const created = await apiRequest('/api/applications', { method: 'POST', body: JSON.stringify({ formData }) });
        application = created.application;
      }
      const result = await apiRequest(`/api/applications/${application.id}/submit`, { method: 'POST', body: JSON.stringify({ formData }) });
      setCurrent(result.application);
      await loadApplications();
      setMessage('Application submitted successfully.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, [current, formData, loadApplications]);

  const usePdfBlob = useCallback(async (mode) => {
    if (!current || user.role !== 'manager') return;
    setBusy(true);
    setMessage('');
    try {
      const path = mode === 'download' ? `/api/applications/${current.id}/pdf` : `/api/applications/${current.id}/generate-pdf`;
      const blob = await pdfRequest(path, { method: mode === 'download' ? 'GET' : 'POST' });
      const url = URL.createObjectURL(blob);
      if (mode === 'download') {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `SBI-Housing-Loan-${current.id}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      } else if (mode === 'print') {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
        frame.src = url;
        frame.onload = () => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          window.setTimeout(() => { URL.revokeObjectURL(url); frame.remove(); }, 60_000);
        };
        document.body.appendChild(frame);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, [current, user]);

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setApplications([]);
    setCurrent(null);
    clearForm();
    window.location.assign('/');
  }, [clearForm]);

  const confirmPreview = () => {
    if (imagePreview.kind === 'photo') setPhoto((currentPhoto) => ({ ...currentPhoto, [imagePreview.placementId]: imagePreview.src }));
    else setSignature((currentSignature) => ({ ...currentSignature, [imagePreview.placementId]: imagePreview.src }));
    setImagePreview(null);
  };

  const handleFieldChange = useCallback((id, value) => {
    if (readOnly) return;
    if (typeof value === 'string') value = value.toUpperCase();
    setValues((storedValues) => {
      const section = addressSyncSections.find(({ yesId, noId, pairs }) =>
        id === yesId || id === noId || pairs.some(({ permanentId, currentId }) => id === permanentId || id === currentId));
      if (!section) return { ...storedValues, [id]: value };
      const { yesId, noId, pairs } = section;
      const syncEnabled = Boolean(storedValues[yesId]);
      if (syncEnabled && pairs.some(({ currentId }) => currentId === id)) return storedValues;
      const next = { ...storedValues, [id]: value };
      if (id === noId && value) {
        next[yesId] = '';
        pairs.forEach(({ currentId }) => { next[currentId] = ''; });
        return next;
      }
      if (id === yesId) {
        if (!value) return next;
        next[noId] = '';
        pairs.forEach(({ permanentId, currentId }) => { next[currentId] = storedValues[permanentId] || ''; });
        return next;
      }
      if (syncEnabled) {
        const pair = pairs.find(({ permanentId }) => permanentId === id);
        if (pair) next[pair.currentId] = value;
      }
      return next;
    });
  }, [readOnly]);

  if (sessionLoading) return <div className="loading full-page">Loading secure application…</div>;
  if (!user && managerMode) return <LoginPage onLogin={async (loggedInUser) => { setUser(loggedInUser); await loadApplications(); }} />;
  if (!user) return <div className="loading full-page">
    <p>{startupError || 'Unable to open the employee application.'}</p>
    <button className="tool-button primary" type="button" onClick={initializeSession}>Try again</button>
  </div>;

  const managerWithoutSelection = user.role === 'manager' && !current;
  return <main className="app-shell">
    <header className="app-header">
      <div><p className="eyebrow">Official SBI Form</p><h1>Housing Loan Application</h1></div>
      {user.role === 'manager' && <div className="session-actions">
        <span className="role-badge manager">Bank Manager</span>
        <span>{user.username}</span>
        <button className="tool-button" onClick={logout}>Sign out</button>
      </div>}
    </header>
    <div className="secure-workspace no-sidebar">
      <section className="form-workspace">
        {message && <div className="status-message" role="status">{message}</div>}
        <PdfToolbar page={page} pageCount={pageCount} scale={scale} fitMode={fitMode} rotation={rotation}
          user={user} applications={applications} currentId={current?.id} hasApplication={Boolean(current)} readOnly={readOnly} busy={busy}
          onPageChange={setPage} onScaleChange={(next) => { setFitMode(null); setScale(next); }}
          onFitMode={setFitMode} onRotate={() => setRotation((value) => (value + 90) % 360)}
          onNew={newApplication} onOpen={openApplication} onReset={clearForm} onSave={saveApplication} onSubmit={submitApplication}
          onGenerate={() => usePdfBlob('generate')} onDownload={() => usePdfBlob('download')} onPrint={() => usePdfBlob('print')} />
        {managerWithoutSelection ? <div className="manager-empty"><h2>Select a submitted application</h2><p>Choose an application from the Actions menu to review its stored form data and generate the official PDF.</p></div> : <>
          <PdfViewer fieldMap={fieldMap} values={values} photo={photo} signature={signature} page={page} scale={scale} fitMode={fitMode} rotation={rotation}
            readOnly={readOnly} mediaActions={{
              onPhotoSelected: (placementId, src) => setImagePreview({ kind: 'photo', placementId, src }),
              onSignatureSelected: (placementId, src) => setImagePreview({ kind: 'signature', placementId, src }),
              onDrawSignature: (placementId) => setDrawingSignature(placementId),
            }} onPageCount={setPageCount} onVisiblePage={setPage} onFieldChange={handleFieldChange} />
        </>}
      </section>
    </div>
    {drawingSignature && !readOnly && <SignatureModal onCancel={() => setDrawingSignature(null)} onSave={(src) => {
      setSignature((currentSignature) => ({ ...currentSignature, [drawingSignature]: src }));
      setDrawingSignature(null);
    }} />}
    {imagePreview && !readOnly && <ImagePreviewModal title={imagePreview.kind === 'photo' ? 'Photo' : 'Signature'}
      kind={imagePreview.kind} src={imagePreview.src} onConfirm={confirmPreview} onCancel={() => setImagePreview(null)} />}
  </main>;
}
