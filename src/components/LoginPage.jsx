import { useState } from 'react';
import { apiRequest } from '../api';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      onLogin(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return <main className="login-shell">
    <form className="login-card" onSubmit={submit}>
      <p className="eyebrow">Official SBI Form</p>
      <h1>Housing Loan Application</h1>
      <p className="login-help">Authorized Bank Managers can sign in to review submitted applications and generate official PDFs.</p>
      <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      {error && <p className="form-message error" role="alert">{error}</p>}
      <button className="print-button login-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>;
}
