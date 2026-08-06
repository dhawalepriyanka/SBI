import { handleApi } from '../server/index.js';

export const config = { maxDuration: 60 };

export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  const forwardedPath = url.searchParams.get('path');
  if (forwardedPath) url.pathname = `/api/${forwardedPath.replace(/^\/+/, '')}`;

  try {
    await handleApi(request, response, url);
  } catch (error) {
    console.error(error);
    if (response.headersSent) return response.end();
    const status = error.status || 500;
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ error: error.status ? error.message : 'Internal server error' }));
  }
}
