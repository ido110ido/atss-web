import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { useAuth } from "../auth/AuthContext";
import { db, storage } from "../firebase-admin";
import { loadPhotoUrlCache, savePhotoUrlCache } from "../lib/photoUrlCache";
import AdminHeader from "../components/AdminHeader";

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export default function Completed() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [photoUrls, setPhotoUrls] = useState(loadPhotoUrlCache);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "deliveries"),
      where("company", "==", profile.company),
      where("status", "==", "done"),
      where("date", ">=", thirtyDaysAgo()),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setLoadError("");
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.date + b.expectedTime).localeCompare(a.date + a.expectedTime));
        setDeliveries(docs);
      },
      (err) => setLoadError(err.message),
    );
  }, [profile.company]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl]);

  // Resolve each delivery's Storage path to an actual downloadable URL once,
  // skipping ones already in the cache (persisted across visits/reloads).
  useEffect(() => {
    for (const d of deliveries) {
      if (d.photoPath && !(d.photoPath in photoUrls)) {
        getDownloadURL(ref(storage, d.photoPath))
          .then((url) => {
            setPhotoUrls((prev) => {
              const next = { ...prev, [d.photoPath]: url };
              savePhotoUrlCache(next);
              return next;
            });
          })
          .catch(() => setPhotoUrls((prev) => ({ ...prev, [d.photoPath]: null })));
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
          <div>
            <h1 className="sec-title" style={{ fontSize: "1.6rem" }}>
              Completed Deliveries
            </h1>
            <p className="import-message" style={{ marginTop: 4, marginBottom: 0 }}>
              Showing the last 30 days.
            </p>
          </div>
        </div>

        {loadError && <p className="import-message is-error">Failed to load completed deliveries: {loadError}</p>}

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
                    ) : photoUrls[d.photoPath] ? (
                      <img
                        src={photoUrls[d.photoPath]}
                        alt="Unloading confirmation"
                        className="confirmation-thumb"
                        loading="lazy"
                        onClick={() => setLightboxUrl(photoUrls[d.photoPath])}
                      />
                    ) : photoUrls[d.photoPath] === null ? (
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

      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" type="button" onClick={() => setLightboxUrl(null)}>
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Unloading confirmation"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
