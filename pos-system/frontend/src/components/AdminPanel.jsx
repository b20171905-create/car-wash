import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const PK_TIMEZONE = 'Asia/Karachi';
const parseTimestamp = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
};
const formatPkDate = (value, options = {}) => parseTimestamp(value).toLocaleDateString('en-PK', { timeZone: PK_TIMEZONE, ...options });

// ── Branches Tab ──────────────────────────────────────────────
function BranchesTab() {
  const [branches, setBranches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionMenuDirection, setActionMenuDirection] = useState('down');
  const closeActionTimerRef = useRef(null);

  const openActionMenu = (id, event) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
      closeActionTimerRef.current = null;
    }
    const triggerBounds = event.currentTarget.getBoundingClientRect();
    setActionMenuDirection(triggerBounds.bottom + 180 > window.innerHeight ? 'up' : 'down');
    setOpenActionId(id);
  };

  const closeActionMenu = (id) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
    }
    closeActionTimerRef.current = setTimeout(() => {
      setOpenActionId((current) => (current === id ? null : current));
    }, 180);
  };

  useEffect(() => { api.getBranches().then(setBranches).catch(() => {}); }, []);

  function resetForm() {
    setForm({ name: '', address: '', phone: '' });
    setEditingId(null);
    setShowForm(false);
  }

  function editBranch(branch) {
    setForm({ name: branch.name || '', address: branch.address || '', phone: branch.phone || '' });
    setEditingId(branch.id);
    setShowForm(true);
    setMsg(null);
  }

  function startAddBranch() {
    resetForm();
    setShowForm(true);
  }

  async function saveBranch(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const wasEditing = Boolean(editingId);
      const b = editingId ? await api.updateBranch(editingId, form) : await api.createBranch(form);
      setBranches((prev) => editingId ? prev.map((item) => item.id === b.id ? b : item) : [...prev, b]);
      resetForm();
      setMsg({ type: 'success', text: `Branch "${b.name}" ${wasEditing ? 'updated' : 'created'}!` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(branch) {
    if (!confirm(`Permanently delete branch "${branch.name}" and all of its users, sales, and sale items? This cannot be undone.`)) return;
    try {
      await api.deleteBranch(branch.id);
      setBranches((prev) => prev.filter((item) => item.id !== branch.id));
      setMsg({ type: 'success', text: `Branch "${branch.name}" and its records were permanently deleted.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div>
      <div className="section-actions">
        <div>
          <div className="section-title">Branches ({branches.length})</div>
          <p style={{ margin: 0 }}>Manage all car wash locations</p>
        </div>
        <button id="add-branch-btn" className="btn btn-primary btn-sm" onClick={() => showForm ? resetForm() : startAddBranch()}>
          {showForm ? '✕ Cancel' : '+ Add Branch'}
        </button>
      </div>

      {msg && <div className={`status-msg ${msg.type}`} style={{ marginBottom: 14 }}>{msg.text}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--border-active)' }}>
          <h4 style={{ marginBottom: 14 }}>{editingId ? 'Edit Branch' : 'New Branch'}</h4>
          <form onSubmit={saveBranch}>
            <div className="form-group">
              <label className="form-label">Branch Name *</label>
              <input className="form-input" placeholder="e.g. Gulshan Branch" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="Street, City" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="+92 300 1234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button id="save-branch-btn" type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner" /> : `✓ ${editingId ? 'Save Changes' : 'Create Branch'}`}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {branches.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🏢</div><div className="empty-title">No branches yet</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Branch Name</th><th>Address</th><th>Phone</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{b.address || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{b.phone || '—'}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{formatPkDate(b.created_at)}</td>
                    <td className="sales-admin-actions">
                      <div
                        className="action-menu"
                        onMouseEnter={(event) => openActionMenu(b.id, event)}
                        onMouseLeave={() => closeActionMenu(b.id)}
                        onFocus={(event) => openActionMenu(b.id, event)}
                        onBlur={() => closeActionMenu(b.id)}
                      >
                        <button
                          className="action-menu-trigger"
                          aria-label={`Actions for branch ${b.name}`}
                          aria-expanded={openActionId === b.id}
                          onClick={() => setOpenActionId((current) => current === b.id ? null : b.id)}
                        >
                          ⋮
                        </button>
                        {openActionId === b.id && (
                          <div className={`action-menu-dropdown${actionMenuDirection === 'up' ? ' open-up' : ''}`}>
                            <button onClick={() => { setOpenActionId(null); editBranch(b); }}>✏️ Edit</button>
                            <button className="danger" onClick={() => { setOpenActionId(null); handleDelete(b); }}>🗑 Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Services Tab ─────────────────────────────────────────────
function ServicesTab() {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', vehicle_type: 'all', price: '', active: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionMenuDirection, setActionMenuDirection] = useState('down');
  const closeActionTimerRef = useRef(null);

  const openActionMenu = (id, event) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
      closeActionTimerRef.current = null;
    }
    const triggerBounds = event.currentTarget.getBoundingClientRect();
    setActionMenuDirection(triggerBounds.bottom + 180 > window.innerHeight ? 'up' : 'down');
    setOpenActionId(id);
  };

  const closeActionMenu = (id) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
    }
    closeActionTimerRef.current = setTimeout(() => {
      setOpenActionId((current) => (current === id ? null : current));
    }, 180);
  };

  useEffect(() => {
    api.getServices().then(setServices).catch((err) => setMsg({ type: 'error', text: err.message }));
  }, []);

  function resetForm() {
    setForm({ name: '', description: '', vehicle_type: 'all', price: '', active: true });
    setEditingId(null);
    setShowForm(false);
  }

  function editService(service) {
    setForm({ ...service, active: Boolean(service.active) });
    setEditingId(service.id);
    setShowForm(true);
    setMsg(null);
  }

  async function saveService(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const wasEditing = Boolean(editingId);
      const servicePayload = { ...form, vehicle_type: (form.vehicle_type || 'all').trim().toLowerCase() };
      const saved = editingId
        ? await api.updateService(editingId, servicePayload)
        : await api.createService(servicePayload);
      setServices((prev) => editingId ? prev.map((s) => s.id === saved.id ? saved : s) : [...prev, saved]);
      resetForm();
      setMsg({ type: 'success', text: `Service ${wasEditing ? 'updated' : 'created'} successfully.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleService(service) {
    try {
      const updated = await api.updateService(service.id, { ...service, active: !service.active });
      setServices((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function deleteService(service) {
    if (!confirm(`Delete service "${service.name}"?`)) return;
    try {
      await api.deleteService(service.id);
      setServices((prev) => prev.filter((s) => s.id !== service.id));
      setMsg({ type: 'success', text: 'Service deleted successfully.' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  return (
    <div>
      <div className="section-actions">
        <div>
          <div className="section-title">Services ({services.length})</div>
          <p style={{ margin: 0 }}>Manage wash packages, prices and availability</p>
        </div>
        <button id="add-service-btn" className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>
          + Add Service
        </button>
      </div>

      {msg && <div className={`status-msg ${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--border-active)' }}>
          <h4 style={{ marginBottom: 14 }}>{editingId ? 'Edit Service' : 'New Service'}</h4>
          <form onSubmit={saveService}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Service Name *</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Price (Rs.) *</label>
                <input className="form-input" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Type *</label>
              <select className="form-select" required value={form.vehicle_type || 'all'} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                <option value="all">All vehicle types</option>
                <option value="bike">Bike</option>
                <option value="car">Car</option>
                <option value="truck">Truck</option>
                <option value="rikshaw">Rikshaw</option>
                <option value="coaster">Coaster</option>
              </select>
            </div>
            <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
              <button id="save-service-btn" type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner" /> : '✓ Save Service'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {services.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🔧</div><div className="empty-title">No services yet</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Service</th><th>Vehicle</th><th>Description</th><th>Price</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td><span className="badge badge-teal">{s.vehicle_type || 'all'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.description || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--teal-light)' }}>Rs. {s.price}</td>
                    <td>
                      <span className={`badge ${s.active ? 'badge-green' : 'badge-gray'}`}>
                        {s.active ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td className="sales-admin-actions">
                      <div
                        className="action-menu"
                        onMouseEnter={(event) => openActionMenu(s.id, event)}
                        onMouseLeave={() => closeActionMenu(s.id)}
                        onFocus={(event) => openActionMenu(s.id, event)}
                        onBlur={() => closeActionMenu(s.id)}
                      >
                        <button
                          className="action-menu-trigger"
                          aria-label={`Actions for service ${s.name}`}
                          aria-expanded={openActionId === s.id}
                          onClick={() => setOpenActionId((current) => current === s.id ? null : s.id)}
                        >
                          ⋮
                        </button>
                        {openActionId === s.id && (
                          <div className={`action-menu-dropdown${actionMenuDirection === 'up' ? ' open-up' : ''}`}>
                            <button onClick={() => { setOpenActionId(null); editService(s); }}>✏️ Edit</button>
                            <button onClick={() => { setOpenActionId(null); toggleService(s); }}>{s.active ? '⏸ Deactivate' : '▶ Activate'}</button>
                            <button className="danger" onClick={() => { setOpenActionId(null); deleteService(s); }}>🗑 Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [form, setForm] = useState({ name: '', email: '', password: '', profile_photo: '', role: 'cashier', branch_id: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionMenuDirection, setActionMenuDirection] = useState('down');
  const closeActionTimerRef = useRef(null);

  const openActionMenu = (id, event) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
      closeActionTimerRef.current = null;
    }
    const triggerBounds = event.currentTarget.getBoundingClientRect();
    setActionMenuDirection(triggerBounds.bottom + 180 > window.innerHeight ? 'up' : 'down');
    setOpenActionId(id);
  };

  const closeActionMenu = (id) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
    }
    closeActionTimerRef.current = setTimeout(() => {
      setOpenActionId((current) => (current === id ? null : current));
    }, 180);
  };

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
    api.getBranches().then(setBranches).catch(() => {});
  }, []);

  const filteredUsers = selectedBranchId === 'all'
    ? users
    : users.filter((u) => String(u.branch_id ?? '') === String(selectedBranchId));

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const created = await api.createUser({ ...form, email: form.email.trim().toLowerCase() });
      setUsers((prev) => [...prev, created]);
      setForm({ name: '', email: '', password: '', profile_photo: '', role: 'cashier', branch_id: '' });
      setShowForm(false);
      setMsg({ type: 'success', text: `User "${created.name}" created! They can now log in.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Deactivate user "${u.name}"?`)) return;
    await api.deleteUser(u.id).catch((e) => alert(e.message));
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  }

  async function handlePasswordReset(u) {
    const password = prompt(`Set a new password for ${u.name} (minimum 6 characters):`);
    if (password === null) return;
    if (password.length < 6) {
      setMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    try {
      await api.updateUser(u.id, { password });
      setMsg({ type: 'success', text: `Password reset for ${u.name}.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  const roleBadge = (role) => {
    const map = { owner: 'badge-purple', branch_manager: 'badge-teal', cashier: 'badge-amber' };
    return map[role] || 'badge-gray';
  };

  return (
    <div>
      <div className="section-actions">
        <div>
          <div className="section-title">Users ({filteredUsers.length})</div>
          <p style={{ margin: 0 }}>Manage staff access across all branches</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <label className="form-label" htmlFor="user-branch-filter" style={{ marginBottom: 6 }}>Filter by Branch</label>
            <select
              id="user-branch-filter"
              className="form-select"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="all">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <button id="add-user-btn" className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ Add User'}
          </button>
        </div>
      </div>

      {msg && <div className={`status-msg ${msg.type}`} style={{ marginBottom: 14 }}>{msg.text}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--border-active)' }}>
          <h4 style={{ marginBottom: 14 }}>New User Account</h4>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="Ahmed Khan" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" placeholder="ahmed@example.com" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Profile Photo</label>
              <input
                className="form-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setMsg({ type: 'error', text: 'Profile photo must be 2 MB or smaller.' });
                    e.target.value = '';
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const image = new Image();
                    image.onload = () => {
                      const canvas = document.createElement('canvas');
                      const size = 256;
                      const scale = Math.min(size / image.width, size / image.height, 1);
                      canvas.width = Math.max(1, Math.round(image.width * scale));
                      canvas.height = Math.max(1, Math.round(image.height * scale));
                      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                      setForm((current) => ({ ...current, profile_photo: canvas.toDataURL('image/jpeg', 0.72) }));
                    };
                    image.src = reader.result;
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {form.profile_photo && <img className="profile-photo-preview" src={form.profile_photo} alt="Profile preview" />}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" placeholder="Min 6 characters" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="cashier">Cashier</option>
                  <option value="branch_manager">Branch Manager</option>
                  <option value="owner">Owner / Admin</option>
                </select>
              </div>
            </div>
            {(form.role === 'cashier' || form.role === 'branch_manager') && (
              <div className="form-group">
                <label className="form-label">Assign Branch *</label>
                <select className="form-select" required value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                  <option value="">— Select branch —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button id="save-user-btn" type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner" /> : '✓ Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {filteredUsers.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No users found for this branch</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div className="user-avatar" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                    <td><span className={`badge ${roleBadge(u.role)}`}>{u.role.replace('_', ' ')}</span></td>
                    <td>{u.branch_name || <span style={{ color: 'var(--text-dim)' }}>All branches</span>}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{formatPkDate(u.created_at)}</td>
                    <td className="sales-admin-actions">
                      <div
                        className="action-menu"
                        onMouseEnter={(event) => openActionMenu(u.id, event)}
                        onMouseLeave={() => closeActionMenu(u.id)}
                        onFocus={(event) => openActionMenu(u.id, event)}
                        onBlur={() => closeActionMenu(u.id)}
                      >
                        <button
                          className="action-menu-trigger"
                          aria-label={`Actions for user ${u.name}`}
                          aria-expanded={openActionId === u.id}
                          onClick={() => setOpenActionId((current) => current === u.id ? null : u.id)}
                        >
                          ⋮
                        </button>
                        {openActionId === u.id && (
                          <div className={`action-menu-dropdown${actionMenuDirection === 'up' ? ' open-up' : ''}`}>
                            <button onClick={() => { setOpenActionId(null); handlePasswordReset(u); }}>🔐 Reset password</button>
                            <button className="danger" onClick={() => { setOpenActionId(null); handleDelete(u); }}>🗑 Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Data Export Tab ──────────────────────────────────────────
function ExportTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState(null);

  async function exportData(event) {
    event.preventDefault();
    setExporting(true);
    setMsg(null);
    try {
      const result = await api.downloadExcelExport({ from, to });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: 'Excel export downloaded successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setExporting(false);
    }
  }

  function exportAll() {
    setFrom('');
    setTo('');
    setMsg(null);
  }

  return (
    <div>
      <div className="section-actions">
        <div>
          <div className="section-title">Export Data</div>
          <p style={{ margin: 0 }}>Download database records to an Excel workbook</p>
        </div>
      </div>

      {msg && <div className={`status-msg ${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginBottom: 8 }}>Choose export range</h3>
        <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
          Leave both dates empty to export all database data. The workbook includes sales, sale items, customers, services, branches, and users.
        </p>
        <form onSubmit={exportData}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="export-from">From date</label>
              <input id="export-from" className="form-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="export-to">To date</label>
              <input id="export-to" className="form-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportAll}>All data</button>
            <button id="export-excel-btn" type="submit" className="btn btn-primary btn-sm" disabled={exporting}>
              {exporting ? <span className="spinner" /> : '↓ Download Excel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────
export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('branches');
  const [tabLoading, setTabLoading] = useState(false);

  function changeTab(tab) {
    setActiveTab(tab);
    setTabLoading(true);
    window.setTimeout(() => setTabLoading(false), 1000);
  }

  return (
    <div>
      <div className="tabs">
        <button id="tab-branches" className={`tab${activeTab === 'branches' ? ' active' : ''}`} onClick={() => changeTab('branches')}>🏢 Branches</button>
        <button id="tab-services" className={`tab${activeTab === 'services' ? ' active' : ''}`} onClick={() => changeTab('services')}>🔧 Services</button>
        <button id="tab-users"    className={`tab${activeTab === 'users'    ? ' active' : ''}`} onClick={() => changeTab('users')}>👥 Users</button>
        <button id="tab-export"   className={`tab${activeTab === 'export'   ? ' active' : ''}`} onClick={() => changeTab('export')}>📥 Export Data</button>
      </div>

      {tabLoading ? (
        <div className="page-loading" role="status" aria-label="Loading admin section">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {activeTab === 'branches' && <BranchesTab />}
          {activeTab === 'services' && <ServicesTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'export' && <ExportTab />}
        </>
      )}
    </div>
  );
}
