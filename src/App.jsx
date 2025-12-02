import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://utpatur-api.onrender.com";

function App() {
  const [huts, setHuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHuts() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/huts?limit=50`);

        if (!res.ok) {
          throw new Error(`Erreur API (${res.status})`);
        }

        const data = await res.json();
        setHuts(data);
      } catch (err) {
        console.error(err);
        setError(err.message ?? "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }

    fetchHuts();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "#f5f7fb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <main style={{ width: "100%", maxWidth: "640px" }}>
        <h1
          style={{
            textAlign: "center",
            fontSize: "2.3rem",
            marginBottom: "0.25rem",
          }}
        >
          UtPaTur – Huts
        </h1>

        <p
          style={{
            textAlign: "center",
            marginBottom: "1.5rem",
            color: "#555",
            fontSize: "0.95rem",
          }}
        >
          Huts reçues depuis l’API : {loading ? "…" : huts.length}
        </p>

        <p
          style={{
            textAlign: "center",
            marginBottom: "1.5rem",
            color: "#888",
            fontSize: "0.8rem",
          }}
        >
          API utilisée : <code>{API_BASE_URL}</code>
        </p>

        {loading && (
          <div style={{ textAlign: "center", color: "#555" }}>Chargement…</div>
        )}

        {error && !loading && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "#fee2e2",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            Erreur : {error}
          </div>
        )}

        {!loading && !error && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {huts.map((h) => (
              <li
                key={h.hut_id ?? `${h.latitude}-${h.longitude}`}
                style={{
                  marginBottom: "0.75rem",
                  padding: "0.9rem 1.1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e3e5ef",
                  boxShadow:
                    "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "0.15rem",
                    fontSize: "1.05rem",
                  }}
                >
                  {h.name || "(sans nom)"}
                </div>

                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "#555",
                    marginBottom: "0.1rem",
                  }}
                >
                  {(h.country_code || "??").toUpperCase()} •{" "}
                  {typeof h.latitude === "number"
                    ? h.latitude.toFixed(4)
                    : h.latitude}
                  ,{" "}
                  {typeof h.longitude === "number"
                    ? h.longitude.toFixed(4)
                    : h.longitude}
                </div>

                {Array.isArray(h.routes_codes) &&
                  h.routes_codes.length > 0 && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#333",
                        marginTop: "0.25rem",
                      }}
                    >
                      Itinéraires : {h.routes_codes.join(" · ")}
                    </div>
                  )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default App;
