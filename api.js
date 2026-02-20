const API_BASE_URL = window.WORKER_API_BASE || 'http://localhost:3001/api';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed: ${response.status}`);
  }

  return response.json();
};

window.workerApi = {
  getWorkers: () => request('/workers'),
  createWorker: (name) => request('/workers', { method: 'POST', body: JSON.stringify({ name }) }),
  getWorkerRatings: (workerId) => request(`/workers/${workerId}/ratings`),
  createRating: (payload) => request('/ratings', { method: 'POST', body: JSON.stringify(payload) }),
};
