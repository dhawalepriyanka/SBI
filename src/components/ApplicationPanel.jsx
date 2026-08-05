function labelFor(application) {
  const time = application.submittedAt || application.updatedAt;
  return `${application.status === 'submitted' ? 'Submitted' : 'Draft'} - ${new Date(time).toLocaleString()}`;
}

export default function ApplicationPanel({ user, applications, currentId, onOpen, onNew }) {
  return <aside className="application-panel">
    <div className="application-panel-heading">
      <div><p className="eyebrow">{user.role === 'manager' ? 'Manager Queue' : 'My Applications'}</p><h2>{user.role === 'manager' ? 'Submitted applications' : 'Drafts and submissions'}</h2></div>
      {user.role === 'employee' && <button className="tool-button" onClick={onNew}>New</button>}
    </div>
    <label className="application-select-label" htmlFor="application-select">
      {user.role === 'manager' ? 'Choose submitted application' : 'Choose draft or submission'}
    </label>
    <select id="application-select" className="application-select" value={currentId || ''}
      disabled={!applications.length} onChange={(event) => event.target.value && onOpen(event.target.value)}>
      <option value="">{applications.length ? 'Select an application' : user.role === 'manager' ? 'No submitted applications' : 'No saved applications yet'}</option>
      {applications.map((application) => <option key={application.id} value={application.id}>
        {application.id.slice(0, 8).toUpperCase()} - {labelFor(application)}{user.role === 'manager' ? ` - ${application.employeeId}` : ''}
      </option>)}
    </select>
  </aside>;
}
