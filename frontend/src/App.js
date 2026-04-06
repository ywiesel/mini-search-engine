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
    () =>
      suggestions.filter(
        (suggestion) => suggestion.toLowerCase() !== trimmedQuery.toLowerCase()
      ),
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
      <header className="hero-shell">
        <nav className="topbar">
          <div className="brand-mark">
            <span className="brand-dot" />
            SkySearch
          </div>
          <div className="topbar-links">
            <span>Search</span>
            <span>Index</span>
            <span>Explore</span>
          </div>
        </nav>

        <div className="hero-grid">
          <section className="hero-copy">
            <p className="eyebrow">Landy-inspired search experience</p>
            <h1>Search your indexed pages with a cleaner, brighter design.</h1>
            <p className="subtitle">
              A light blue and white interface for browsing your crawler data,
              with autocomplete suggestions and highlighted matches built in.
            </p>

            <div className="hero-actions">
              <span className="hero-pill">Fast suggestions</span>
              <span className="hero-pill">Live crawler data</span>
              <span className="hero-pill">Readable snippets</span>
            </div>
          </section>

          <section className="hero-panel">
            <div className="panel-card">
              <p className="panel-label">Try a search</p>

              <form className="search-form" onSubmit={handleSearch}>
                <div className="search-input-wrap">
                  <input
                    type="text"
                    value={query}
                    placeholder="Search for python, react, docs..."
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
                  {showSuggestions &&
                    (visibleSuggestions.length > 0 || suggestionsLoading) && (
                      <div className="suggestions-panel">
                        {suggestionsLoading && (
                          <p className="suggestions-status">
                            Looking up suggestions...
                          </p>
                        )}
                        {!suggestionsLoading &&
                          visibleSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              className="suggestion-item"
                              onMouseDown={() =>
                                handleSuggestionClick(suggestion)
                              }
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
              {!error && loading && (
                <p className="status-message">Searching...</p>
              )}
              {!loading && !error && query.trim() && results.length === 0 && (
                <p className="status-message">
                  No results found for "{query.trim()}".
                </p>
              )}

              <div className="search-hints">
                <span>Popular:</span>
                <button type="button" onClick={() => handleSuggestionClick("python")}>
                  python
                </button>
                <button type="button" onClick={() => handleSuggestionClick("react")}>
                  react
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick("web development")}
                >
                  web development
                </button>
              </div>
            </div>
          </section>
        </div>
      </header>

      <section className="features-row">
        <article className="feature-card">
          <p className="feature-kicker">Smart</p>
          <h2>Autocomplete suggestions</h2>
          <p>Helpful suggestions appear as you type so you can search faster.</p>
        </article>
        <article className="feature-card">
          <p className="feature-kicker">Focused</p>
          <h2>Highlighted results</h2>
          <p>Your matching terms are emphasized inside titles and snippets.</p>
        </article>
        <article className="feature-card">
          <p className="feature-kicker">Fresh</p>
          <h2>Crawler-powered data</h2>
          <p>Bring in more web pages and search across a growing local index.</p>
        </article>
      </section>

      <section className="results-section">
        <div className="section-heading">
          <p className="eyebrow">Results</p>
          <h2>Browse what your engine found</h2>
        </div>

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
      </section>
    </div>
  );
}

export default App;
