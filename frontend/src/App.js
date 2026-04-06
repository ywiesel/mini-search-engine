import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(text, searchQuery) {
  const terms = Array.from(
    new Set(
      searchQuery
        .toLowerCase()
        .match(/\w+/g)
        ?.filter(Boolean) || []
    )
  );

  if (!text || terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    terms.includes(part.toLowerCase()) ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
}

function App() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");

  const apiBaseUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:5050";

  const trimmedQuery = query.trim();
  const visibleSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.toLowerCase() !== trimmedQuery.toLowerCase()),
    [suggestions, trimmedQuery]
  );

  useEffect(() => {
    let ignore = false;

    const fetchSuggestions = async () => {
      if (trimmedQuery.length < 2) {
        setSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      setSuggestionsLoading(true);

      try {
        const res = await fetch(
          `${apiBaseUrl}/suggest?q=${encodeURIComponent(trimmedQuery)}`
        );
        if (!res.ok) {
          throw new Error(`Suggestion request failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!ignore) {
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        if (!ignore) {
          setSuggestions([]);
        }
      } finally {
        if (!ignore) {
          setSuggestionsLoading(false);
        }
      }
    };

    fetchSuggestions();

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, trimmedQuery]);

  const runSearch = async (nextQuery) => {
    const normalizedQuery = nextQuery.trim();

    if (!normalizedQuery) {
      setResults([]);
      setSubmittedQuery("");
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setSubmittedQuery(normalizedQuery);
    setShowSuggestions(false);

    try {
      const res = await fetch(
        `${apiBaseUrl}/search?q=${encodeURIComponent(normalizedQuery)}`
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

  const handleSearch = async (event) => {
    event.preventDefault();
    await runSearch(query);
  };

  const handleSuggestionClick = async (suggestion) => {
    setQuery(suggestion);
    await runSearch(suggestion);
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
          <div className="search-input-wrap">
            <input
              type="text"
              value={query}
              placeholder="Search..."
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 120);
              }}
              aria-label="Search query"
              autoComplete="off"
            />
            {showSuggestions && (visibleSuggestions.length > 0 || suggestionsLoading) && (
              <div className="suggestions-panel">
                {suggestionsLoading && (
                  <p className="suggestions-status">Looking up suggestions...</p>
                )}
                {!suggestionsLoading &&
                  visibleSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="suggestion-item"
                      onMouseDown={() => handleSuggestionClick(suggestion)}
                    >
                      {highlightMatches(suggestion, query)}
                    </button>
                  ))}
              </div>
            )}
          </div>
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
                {highlightMatches(result.title, submittedQuery)}
              </a>
              <p>{highlightMatches(result.snippet, submittedQuery)}</p>
              <span>{result.url}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
