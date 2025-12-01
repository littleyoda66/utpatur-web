import { useEffect, useState } from "react";
import "./App.css";

// 👉 Mets ici l'URL de ton backend Render
// par ex. celle que tu utilises pour /health
const API_BASE_URL = "https://utpatur-api.onrender.com";

function App() {
  const [huts, setHuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadHuts() {
      try {
        const res = await fetch(`${API_BASE_URL}/huts?limit=50`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setHuts(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }

    loadHuts();
  }, []);

  if (loading) {
    return <div style={{ padding: "1rem" }}>Chargement des huts…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "1rem", color: "red" }}>
        Erreur lors du chargement des huts : {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>UtPaTur – Huts</h1>
      <p>Huts reçues depuis l’API : {huts.length}</p>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {huts.map((h) => (
          <li
            key={h.hut_id ?? `${h.latitude}-${h.longitude}`}
            style={{
              marginBottom: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #ddd",
            }}
          >
            <strong>{h.name || "(sans nom)"}</strong>
            <div style={{ fontSize: "0.9rem", color: "#555" }}>
              {h.country_code || "??"} • {h.latitude.toFixed(4)},{" "}
              {h.longitude.toFixed(4)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
