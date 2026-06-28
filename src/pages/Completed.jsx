import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { useAuth } from "../auth/AuthContext";
import { db, storage } from "../firebase-admin";
import AdminHeader from "../components/AdminHeader";

export default function Completed() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [search, setSearch] = useState("");
  const [photoUrls, setPhotoUrls] = useState({});

  useEffect(() => {
    const q = query(
      collection(db, "deliveries"),
      where("company", "==", profile.company),
      where("status", "==", "done"),
    );
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.date + b.expectedTime).localeCompare(a.date + a.expectedTime));
      setDeliveries(docs);
    });
  }, [profile.company]);

  // Resolve each delivery's Storage path to an actual downloadable URL once,
  // skipping ones we've already fetched.
  useEffect(() => {
    for (const d of deliveries) {
      if (d.photoPath && !(d.id in photoUrls)) {
        getDownloadURL(ref(storage, d.photoPath))
          .then((url) => setPhotoUrls((prev) => ({ ...prev, [d.id]: url })))
          .catch(() => setPhotoUrls((prev) => ({ ...prev, [d.id]: null })));
      }
    }
  }, [deliveries, photoUrls]);

  const filteredDeliveries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deliveries;
    return deliveries.filter((d) => {
      const haystack = `${d.storeBranch} ${d.address} ${d.driverName} ${d.workerName}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [deliveries, search]);

  return (
    <div className="dashboard">
      <AdminHeader active="completed" />

      <div className="dashboard-body">
        <div className="dashboard-toolbar">
          <h1 className="sec-title" style={{ fontSize: "1.6rem" }}>
            Completed Deliveries
          </h1>
        </div>

        <div className="table-controls">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search branch, address, driver, worker…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="results-count">
            {filteredDeliveries.length} of {deliveries.length} completed
          </span>
        </div>

        <div className="table-card">
          <table className="shipments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Branch</th>
                <th>Address</th>
                <th>Driver</th>
                <th>Worker</th>
                <th>Boxes</th>
                <th>Photo</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.length === 0 && (
                <tr>
                  <td colSpan={8} className="shipments-empty">
                    {deliveries.length === 0 ? "No completed deliveries yet." : "No completed deliveries match your search."}
                  </td>
                </tr>
              )}
              {filteredDeliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.date}</td>
                  <td>{d.expectedTime}</td>
                  <td>{d.storeBranch}</td>
                  <td>{d.address}</td>
                  <td>{d.driverName}</td>
                  <td>{d.workerName}</td>
                  <td>{d.boxCount || "—"}</td>
                  <td>
                    {!d.photoPath ? (
                      "—"
                    ) : photoUrls[d.id] ? (
                      <a href={photoUrls[d.id]} target="_blank" rel="noreferrer">
                        <img src={photoUrls[d.id]} alt="Unloading confirmation" className="confirmation-thumb" />
                      </a>
                    ) : photoUrls[d.id] === null ? (
                      "Unavailable"
                    ) : (
                      "Loading…"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
