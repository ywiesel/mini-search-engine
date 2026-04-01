import React, { useState } from "react";

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/search?q=${query}`);
      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      console.error("Error fetching search results:", err);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Mini Search Engine 🔍</h1>

      {/* Search Input */}
      <input
        type="text"
        value={query}
        placeholder="Search..."
        onChange={(e) => setQuery(e.target.value)}
        style={{ padding: "10px", width: "300px" }}
      />

      <button onClick={handleSearch} style={{ marginLeft: "10px", padding: "10px" }}>
        Search
      </button>

      {/* Loading */}
      {loading && <p>Searching...</p>}

      {/* Results */}
      <ul style={{ marginTop: "20px" }}>
        {results.map((r, i) => (
          <li key={i} style={{ marginBottom: "20px" }}>
            <h3>{r.title}</h3>
            <p>{r.snippet}</p>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
