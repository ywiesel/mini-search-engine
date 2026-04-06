import React, { useState } from "react";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiBaseUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:5050";

  const handleSearch = async (event) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${apiBaseUrl}/search?q=${encodeURIComponent(trimmedQuery)}`
      );
      if (!res.ok) {
        throw new Error(`Search request failed with status ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      console.error("Error:", err);
      setResults([]);
      setError("Search is unavailable right now. Make sure the Flask API is running.");
    }

    setLoading(false);
  };

  return (
    <div className="app-shell">
      <div className="search-card">
        <p className="eyebrow">Mini Search Engine</p>
        <h1>Search your indexed pages</h1>
        <p className="subtitle">
          Try searches like <span>python</span>, <span>react</span>, or{" "}
          <span>web development</span>.
        </p>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            placeholder="Search..."
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <p className="status-message error">{error}</p>}
        {!error && loading && <p className="status-message">Searching...</p>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="status-message">No results found for "{query.trim()}".</p>
        )}

        <ul className="results-list">
          {results.map((result) => (
            <li key={result.url} className="result-card">
              <a href={result.url} target="_blank" rel="noreferrer">
                {result.title}
              </a>
              <p>{result.snippet}</p>
              <span>{result.url}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
