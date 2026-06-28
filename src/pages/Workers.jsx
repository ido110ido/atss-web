import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase-admin";
import { addWorker, updateWorker, uploadWorkersFile } from "../lib/workers";
import { colorForIndex, colorForKey, initials } from "../lib/colors";
import AdminHeader from "../components/AdminHeader";

const EMPTY_ADD_FORM = { name: "", phone: "", address: "", language: "" };

export default function Workers() {
  const { profile } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [imports, setImports] = useState([]);
  const [importState, setImportState] = useState({ status: "idle", message: "" });
  const fileInputRef = useRef(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addState, setAddState] = useState({ status: "idle", message: "" });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", language: "" });
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "workers"), where("company", "==", profile.company));
    return onSnapshot(q, (snapshot) => {
      // Workers created before the storeId->address rename don't have an
      // `address` field at all yet — fall back to "" so old records still
      // render instead of crashing the sort.
      const docs = snapshot.docs.map((d) => ({ id: d.id, address: "", ...d.data() }));
      docs.sort((a, b) => a.address.localeCompare(b.address) || a.name.localeCompare(b.name));
      setWorkers(docs);
    });
  }, [profile.company]);

  const storeColors = useMemo(() => {
    const map = new Map();
    [...new Set(workers.map((w) => w.address))].forEach((s, i) => map.set(s, colorForIndex(i)));
    return map;
  }, [workers]);

  useEffect(() => {
    const q = query(collection(db, "workerImports"), where("company", "==", profile.company));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      setImports(docs.slice(0, 5));
    });
  }, [profile.company]);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setImportState({ status: "uploading", message: "" });
    try {
      await uploadWorkersFile(file, profile.company);
      setImportState({
        status: "done",
        message: "File uploaded — processing now, the list below will update automatically.",
      });
    } catch (err) {
      setImportState({ status: "error", message: err.message });
    } finally {
      e.target.value = "";
    }
  }

  function handleAddChange(e) {
    setAddForm({ ...addForm, [e.target.name]: e.target.value });
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setAddState({ status: "saving", message: "" });
    try {
      await addWorker({ company: profile.company, ...addForm });
      setAddForm(EMPTY_ADD_FORM);
      setShowAddForm(false);
      setAddState({ status: "idle", message: "" });
    } catch (err) {
      setAddState({ status: "error", message: err.message });
    }
  }

  function startEdit(worker) {
    setEditingId(worker.id);
    setEditError("");
    setEditForm({ name: worker.name, phone: worker.phone, address: worker.address, language: worker.language || "" });
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleEditSubmit(e, workerId) {
    e.preventDefault();
    try {
      await updateWorker(workerId, editForm);
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function toggleActive(worker) {
    try {
      await updateWorker(worker.id, { active: !worker.active });
    } catch (err) {
      setEditError(err.message);
    }
  }

  return (
    <div className="dashboard">
      <AdminHeader active="workers" />

      <div className="dashboard-body">
        <div className="dashboard-toolbar">
          <h1 className="sec-title" style={{ fontSize: "1.6rem" }}>
            Workers
          </h1>
          <div className="dashboard-upload">
            <button
              className="nav-contact"
              type="button"
              onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? "Cancel" : "Add worker"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={importState.status === "uploading"}
              style={{ display: "none" }}
            />
            <button
              className="btn-send"
              type="button"
              disabled={importState.status === "uploading"}
              onClick={() => fileInputRef.current.click()}>
              {importState.status === "uploading" ? "Uploading…" : "Upload workers list"}
            </button>
          </div>
        </div>

        {importState.message && (
          <p className={importState.status === "error" ? "import-message is-error" : "import-message"}>
            {importState.message}
          </p>
        )}

        {showAddForm && (
          <form className="worker-add-form" onSubmit={handleAddSubmit}>
            <input
              className="field"
              name="name"
              placeholder="Full name"
              value={addForm.name}
              onChange={handleAddChange}
              required
            />
            <input
              className="field"
              name="phone"
              placeholder="Phone (050-1234567)"
              value={addForm.phone}
              onChange={handleAddChange}
              required
            />
            <input
              className="field"
              name="address"
              placeholder="Address (e.g. קניון גבעתיים, דרך יצחק רבין, גבעתיים)"
              value={addForm.address}
              onChange={handleAddChange}
              required
            />
            <input
              className="field"
              name="language"
              placeholder="Language (optional)"
              value={addForm.language}
              onChange={handleAddChange}
            />
            <button className="btn-send" type="submit" disabled={addState.status === "saving"}>
              {addState.status === "saving" ? "Saving…" : "Save worker"}
            </button>
          </form>
        )}
        {addState.status === "error" && <p className="import-message is-error">{addState.message}</p>}
        {editError && <p className="import-message is-error">{editError}</p>}

        <div className="table-card">
        <table className="shipments-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Language</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr>
                <td colSpan={6} className="shipments-empty">
                  No workers yet — add one or upload a list to get started.
                </td>
              </tr>
            )}
            {workers.map((w, i) => {
              const color = storeColors.get(w.address);
              const showHeader = i === 0 || workers[i - 1].address !== w.address;
              return (
                <Fragment key={w.id}>
                  {showHeader && (
                    <tr className="group-header-row">
                      <td colSpan={6} style={{ borderLeft: `4px solid ${color}` }}>
                        <span className="group-header-label" style={{ color }}>
                          {w.address}
                        </span>
                      </td>
                    </tr>
                  )}
                  {editingId === w.id ? (
                    <tr>
                      <td style={{ borderLeft: `4px solid ${color}` }}>
                        <input
                          className="field field-inline"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          className="field field-inline"
                          name="phone"
                          value={editForm.phone}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          className="field field-inline"
                          name="address"
                          value={editForm.address}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          className="field field-inline"
                          name="language"
                          value={editForm.language}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <span className={`status-block ${w.active ? "status-block-done" : "status-block-pending"}`}>
                          {w.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="worker-row-actions">
                        <button className="nav-contact" type="button" onClick={(e) => handleEditSubmit(e, w.id)}>
                          Save
                        </button>
                        <button className="nav-contact" type="button" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td style={{ borderLeft: `4px solid ${color}` }}>
                        <div className="worker-cell">
                          <span className="avatar" style={{ background: colorForKey(w.name) }}>
                            {initials(w.name)}
                          </span>
                          <span className="worker-name">{w.name}</span>
                        </div>
                      </td>
                      <td>{w.phone}</td>
                      <td>{w.address}</td>
                      <td>{w.language || "—"}</td>
                      <td>
                        <span className={`status-block ${w.active ? "status-block-done" : "status-block-pending"}`}>
                          {w.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="worker-row-actions">
                        <button className="nav-contact" type="button" onClick={() => startEdit(w)}>
                          Edit
                        </button>
                        <button className="nav-contact" type="button" onClick={() => toggleActive(w)}>
                          {w.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>

        {imports.length > 0 && (
          <div className="imports-log">
            <h2 className="imports-log-title">Recent uploads</h2>
            <div className="table-card">
              <table className="shipments-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Workers added/updated</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id}>
                      <td>{imp.fileName}</td>
                      <td>
                        <span className={`status-badge status-${imp.status === "error" ? "error" : imp.status}`}>
                          {imp.status}
                        </span>
                      </td>
                      <td>{imp.workerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
