export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function pdfRequest(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.blob();
}
