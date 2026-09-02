// Central backend — one server shared by all branches
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

// Local print agent running on each branch's Windows PC (for thermal ESC/POS)
const PRINT_AGENT_BASE = import.meta.env.VITE_PRINT_AGENT_BASE || 'http://localhost:9100';

function authHeaders() {
  const token = localStorage.getItem('pos_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch (netErr) {
    if (netErr?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw new Error(`Network error: Unable to reach backend (${netErr.message})`);
  } finally {
    clearTimeout(timer);
  }

  let data = {};
  const text = await res.text();
  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.length > 200 ? `Server error (HTTP ${res.status}). Check server logs.` : text };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.reload();
    }
    throw new Error(data.error || data.message || `Request failed (HTTP ${res.status})`);
  }
  return data;
}

export const api = {
  // ── Auth ─────────────────────────────────────────────
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // ── Branches ─────────────────────────────────────────
  getBranches: () => request('/branches'),

  createBranch: (data) =>
    request('/branches', { method: 'POST', body: JSON.stringify(data) }),

  updateBranch: (id, data) =>
    request(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteBranch: (id) =>
    request(`/branches/${id}`, { method: 'DELETE' }),

  // ── Services ─────────────────────────────────────────
  getServices: () => request('/services'),

  createService: (data) =>
    request('/services', { method: 'POST', body: JSON.stringify(data) }),

  updateService: (id, data) =>
    request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteService: (id) =>
    request(`/services/${id}`, { method: 'DELETE' }),

  // ── Users ─────────────────────────────────────────────
  getUsers: () => request('/users'),

  createUser: (data) =>
    request('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id, data) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id) =>
    request(`/users/${id}`, { method: 'DELETE' }),

  // ── Sales ─────────────────────────────────────────────
  createSale: (payload) =>
    request('/sales', { method: 'POST', body: JSON.stringify(payload) }),

  getSales: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/sales${qs ? `?${qs}` : ''}`);
  },

  getSale: (id) => request(`/sales/${id}`),

  deleteSale: (id) => request(`/sales/${id}`, { method: 'DELETE' }),

  getSummary: () => request('/sales/summary'),

  getMonthlySummary: (year) => request(`/sales/monthly-summary${year ? `?year=${encodeURIComponent(year)}` : ''}`),

  getYearlySummary: (year) => request(`/sales/monthly-summary?year=${encodeURIComponent(year)}`),

  getMonthDailySummary: (month) => request(`/sales/month-daily-summary?month=${encodeURIComponent(month)}`),

  markPrinted: (id) =>
    request(`/sales/${id}/mark-printed`, { method: 'POST' }),

  // ── Local Thermal Print Agent (per-branch PC) ─────────
  printThermal: async (receiptPrintPayload) => {
    if (!receiptPrintPayload) {
      return { printed: false, error: 'No thermal receipt data available' };
    }
    try {
      const res = await fetch(`${PRINT_AGENT_BASE}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_print_payload: receiptPrintPayload }),
      });
      const text = await res.text();
      return text && text.trim() ? JSON.parse(text) : { printed: res.ok };
    } catch {
      return { printed: false, error: 'Print agent not reachable' };
    }
  },
};
