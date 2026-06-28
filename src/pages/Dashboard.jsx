import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase-admin";
import { uploadDeliveriesFile } from "../lib/imports";
import { triggerMorningPush } from "../lib/morningPush";
import { colorForIndex, colorForKey, initials } from "../lib/colors";
import AdminHeader from "../components/AdminHeader";

const STATUS_LABEL = {
  pending: "Pending",
  sent: "Sent",
  in_progress: "On the way",
  awaiting_photo: "Unloading",
  done: "Done",
  issue: "Issue",
};

// Order chips appear in within a row, and the column-filter dropdown.
const STATUS_ORDER = ["pending", "sent", "in_progress", "awaiting_photo", "done", "issue"];

// Each Excel row fans out into one delivery doc per worker at that address,
// and a worker can have several deliveries to the same address across a day.
// Group those back into one row per (worker, address) pair — the actual
// assignment unit, since that's the matching key — with the individual
// deliveries (which may span several branches at that address) available as
// an expandable detail list.
function groupByWorkerStore(docs) {
  const groups = new Map();

  for (const d of docs) {
    const key = `${d.workerId}|${d.address}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        workerId: d.workerId,
        workerName: d.workerName,
        workerPhone: d.workerPhone,
        address: d.address || "",
        branches: new Set(),
        deliveries: [],
        counts: { pending: 0, sent: 0, in_progress: 0, awaiting_photo: 0, done: 0, issue: 0 },
      };
      groups.set(key, g);
    }
    g.deliveries.push(d);
    g.counts[d.status] = (g.counts[d.status] || 0) + 1;
    if (d.storeBranch) g.branches.add(d.storeBranch);
  }

  const result = [...groups.values()];
  for (const g of result) {
    g.deliveries.sort((a, b) => (a.date + a.expectedTime).localeCompare(b.date + b.expectedTime));
    g.branchLabel = [...g.branches].join(", ");
  }
  return result.sort((a, b) => a.address.localeCompare(b.address) || a.workerName.localeCompare(b.workerName));
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [imports, setImports] = useState([]);
  const [importState, setImportState] = useState({ status: "idle", message: "" });
  const fileInputRef = useRef(null);
  const [search, setSearch] = useState("");
  const [addressFilter, setAddressFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState(new Set());
  const [pushState, setPushState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    // Completed deliveries move to the Completed page instead of cluttering
    // the active operational view — fetch everything except "done" here.
    const q = query(
      collection(db, "deliveries"),
      where("company", "==", profile.company),
      where("status", "in", ["pending", "sent", "in_progress", "awaiting_photo", "issue"]),
    );
    return onSnapshot(q, (snapshot) => {
      setDeliveries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [profile.company]);

  useEffect(() => {
    const q = query(collection(db, "imports"), where("company", "==", profile.company));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      setImports(docs.slice(0, 5));
    });
  }, [profile.company]);

  const groups = useMemo(() => groupByWorkerStore(deliveries), [deliveries]);

  const addressOptions = useMemo(() => [...new Set(groups.map((g) => g.address))].sort(), [groups]);
  const workerOptions = useMemo(() => [...new Set(groups.map((g) => g.workerName))].sort(), [groups]);

  const addressColors = useMemo(() => {
    const map = new Map();
    addressOptions.forEach((a, i) => map.set(a, colorForIndex(i)));
    return map;
  }, [addressOptions]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (addressFilter !== "all" && g.address !== addressFilter) return false;
      if (workerFilter !== "all" && g.workerName !== workerFilter) return false;
      if (statusFilter !== "all" && !g.counts[statusFilter]) return false;
      if (term) {
        const haystack = `${g.address} ${g.branchLabel} ${g.workerName} ${g.workerPhone}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [groups, search, addressFilter, workerFilter, statusFilter]);

  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleStatusFilter(status) {
    setStatusFilter((prev) => (prev === status ? "all" : status));
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setImportState({ status: "uploading", message: "" });
    try {
      await uploadDeliveriesFile(file, profile.company);
      setImportState({
        status: "done",
        message: "File uploaded — processing now, the table below will update automatically.",
      });
    } catch (err) {
      setImportState({ status: "error", message: err.message });
    } finally {
      e.target.value = "";
    }
  }

  async function handleSendMorningPush() {
    setPushState({ status: "sending", message: "" });
    try {
      const stats = await triggerMorningPush();
      setPushState({
        status: "done",
        message: `Sent to ${stats.successfulWorkers} of ${stats.totalWorkers} worker(s)${
          stats.failedWorkers ? ` — ${stats.failedWorkers} failed, check logs` : ""
        }.`,
      });
    } catch (err) {
      setPushState({ status: "error", message: err.message });
    }
  }

  return (
    <div className="dashboard">
      <AdminHeader active="deliveries" />

      <div className="dashboard-body">
        <div className="dashboard-toolbar">
          <h1 className="sec-title" style={{ fontSize: "1.6rem" }}>
            Deliveries
          </h1>
          <div className="dashboard-upload">
            <button
              className="nav-contact"
              type="button"
              disabled={pushState.status === "sending"}
              onClick={handleSendMorningPush}>
              {pushState.status === "sending" ? "Sending…" : "Send morning push now"}
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
              {importState.status === "uploading" ? "Uploading…" : "Upload next-day deliveries"}
            </button>
          </div>
        </div>

        {pushState.message && (
          <p className={pushState.status === "error" ? "import-message is-error" : "import-message"}>
            {pushState.message}
          </p>
        )}

        {importState.message && (
          <p className={importState.status === "error" ? "import-message is-error" : "import-message"}>
            {importState.message}
          </p>
        )}

        <div className="table-controls">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search address, branch, worker, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {statusFilter !== "all" && (
            <button className="filter-pill is-active" type="button" onClick={() => setStatusFilter("all")}>
              {STATUS_LABEL[statusFilter]} ✕
            </button>
          )}
          <span className="results-count">
            {filteredGroups.length} of {groups.length} rows
          </span>
        </div>

        <div className="table-card">
          <table className="shipments-table monday-table">
            <thead>
              <tr>
                <th className="expand-col" />
                <th>
                  <div className="th-with-filter">
                    Address
                    <select value={addressFilter} onChange={(e) => setAddressFilter(e.target.value)}>
                      <option value="all">All</option>
                      {addressOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>Branches</th>
                <th>
                  <div className="th-with-filter">
                    Worker
                    <select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
                      <option value="all">All</option>
                      {workerOptions.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 && (
                <tr>
                  <td colSpan={5} className="shipments-empty">
                    {groups.length === 0 ? "No deliveries yet — upload a file to get started." : "No rows match your filters."}
                  </td>
                </tr>
              )}
              {filteredGroups.map((g, i) => {
                const color = addressColors.get(g.address);
                const showHeader = i === 0 || filteredGroups[i - 1].address !== g.address;
                return (
                  <Fragment key={g.key}>
                    {showHeader && (
                      <tr className="group-header-row">
                        <td colSpan={5} style={{ borderLeft: `4px solid ${color}` }}>
                          <span className="group-header-label" style={{ color }}>
                            {g.address}
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="group-row" onClick={() => toggleExpand(g.key)}>
                      <td className="expand-cell" style={{ borderLeft: `4px solid ${color}` }}>
                        <span className={`chevron${expanded.has(g.key) ? " is-open" : ""}`}>▸</span>
                      </td>
                      <td className="branch-cell">{g.address}</td>
                      <td>{g.branchLabel || "—"}</td>
                      <td>
                        <div className="worker-cell">
                          <span className="avatar" style={{ background: colorForKey(g.workerName) }}>
                            {initials(g.workerName)}
                          </span>
                          <div className="worker-info">
                            <span className="worker-name">{g.workerName}</span>
                            <span className="worker-phone">{g.workerPhone}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="status-chip-group">
                          {STATUS_ORDER.filter((s) => g.counts[s] > 0).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={`status-chip chip-${s}${statusFilter === s ? " is-active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStatusFilter(s);
                              }}>
                              {g.counts[s]} {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {expanded.has(g.key) && (
                      <tr className="detail-row">
                        <td colSpan={5}>
                          <table className="detail-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Branch</th>
                                <th>Driver</th>
                                <th>License Plate</th>
                                <th>Boxes</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.deliveries.map((d) => (
                                <tr key={d.id}>
                                  <td>{d.date}</td>
                                  <td>{d.expectedTime}</td>
                                  <td>{d.storeBranch || "—"}</td>
                                  <td>{d.driverName}</td>
                                  <td>{d.licensePlate || "—"}</td>
                                  <td>{d.boxCount || "—"}</td>
                                  <td className="status-cell-wrap">
                                    <span className={`status-block status-block-${d.status}`}>
                                      {STATUS_LABEL[d.status] || d.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                    <th>Deliveries created</th>
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
                      <td>{imp.deliveryCount}</td>
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
