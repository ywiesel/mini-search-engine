import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const PAGE_SIZE = 5;

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
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [error, setError] = useState("");
  const [searchMeta, setSearchMeta] = useState({
    total: 0,
    searchTimeMs: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });
  const [stats, setStats] = useState({
    totalDocuments: 0,
    uniqueTerms: 0,
    uniqueDomains: 0,
    lastIndexed: null,
    topDomains: [],
  });

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
    setSelectedSuggestionIndex(-1);
  }, [visibleSuggestions]);

  useEffect(() => {
    let ignore = false;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/stats`);
        if (!res.ok) {
          throw new Error(`Stats request failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!ignore) {
          setStats(data);
        }
      } catch (err) {
        if (!ignore) {
          setStats({
            totalDocuments: 0,
            uniqueTerms: 0,
            uniqueDomains: 0,
            lastIndexed: null,
            topDomains: [],
          });
        }
      }
    };

    fetchStats();

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl]);

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

  const runSearch = async (nextQuery, nextPage = 1) => {
    const normalizedQuery = nextQuery.trim();

    if (!normalizedQuery) {
      setResults([]);
      setSubmittedQuery("");
      setError("");
      setSearchMeta({
        total: 0,
        searchTimeMs: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 0,
      });
      return;
    }

    setLoading(true);
    setError("");
    setSubmittedQuery(normalizedQuery);
    setShowSuggestions(false);

    try {
      const res = await fetch(
        `${apiBaseUrl}/search?q=${encodeURIComponent(normalizedQuery)}&page=${nextPage}&page_size=${PAGE_SIZE}`
      );
      if (!res.ok) {
        throw new Error(`Search request failed with status ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results);
      setSearchMeta({
        total: data.total || 0,
        searchTimeMs: data.searchTimeMs || 0,
        page: data.page || nextPage,
        pageSize: data.pageSize || PAGE_SIZE,
        totalPages: data.totalPages || 0,
      });
    } catch (err) {
      console.error("Error:", err);
      setResults([]);
      setSearchMeta({
        total: 0,
        searchTimeMs: 0,
        page: nextPage,
        pageSize: PAGE_SIZE,
        totalPages: 0,
      });
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

  const handlePageChange = async (nextPage) => {
    await runSearch(submittedQuery || query, nextPage);
  };

  const handleQueryKeyDown = async (event) => {
    if (event.key === "ArrowDown" && visibleSuggestions.length > 0) {
      event.preventDefault();
      setShowSuggestions(true);
      setSelectedSuggestionIndex((currentIndex) =>
        currentIndex < visibleSuggestions.length - 1 ? currentIndex + 1 : 0
      );
      return;
    }

    if (event.key === "ArrowUp" && visibleSuggestions.length > 0) {
      event.preventDefault();
      setSelectedSuggestionIndex((currentIndex) =>
        currentIndex > 0 ? currentIndex - 1 : visibleSuggestions.length - 1
      );
      return;
    }

    if (event.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      return;
    }

    if (event.key === "Enter" && selectedSuggestionIndex >= 0) {
      event.preventDefault();
      const selectedSuggestion = visibleSuggestions[selectedSuggestionIndex];
      if (selectedSuggestion) {
        await handleSuggestionClick(selectedSuggestion);
      }
    }
  };

  const firstResultIndex =
    searchMeta.total > 0 ? (searchMeta.page - 1) * searchMeta.pageSize + 1 : 0;
  const lastResultIndex =
    searchMeta.total > 0
      ? Math.min(searchMeta.page * searchMeta.pageSize, searchMeta.total)
      : 0;
  const formattedIndexedDate = stats.lastIndexed
    ? new Date(stats.lastIndexed * 1000).toLocaleString()
    : "Unavailable";

  return (
    <div className="app-shell">
      <header className="hero-shell">
        <nav className="topbar">
          <div className="brand-mark">
            <span className="brand-dot" />
            Northstar Search
          </div>
          <div className="topbar-links">
            <span>Search Workspace</span>
            <span>Relevance</span>
            <span>Analytics</span>
          </div>
        </nav>

        <div className="hero-grid">
          <section className="hero-copy">
            <p className="eyebrow">Independent Search Platform</p>
            <h1>Search your own indexed web content with clarity and control.</h1>
            <p className="subtitle">
              Northstar Search gives your crawler data a professional interface:
              fast lookup, ranked results, index analytics, and a workflow that
              feels built for real search operations.
            </p>

            <div className="hero-actions">
              <span className="hero-pill">Fast suggestions</span>
              <span className="hero-pill">Weighted ranking</span>
              <span className="hero-pill">Index visibility</span>
            </div>
          </section>

          <section className="hero-panel">
            <div className="panel-card">
              <p className="panel-label">Search the index</p>

              <form className="search-form" onSubmit={handleSearch}>
                <div className="search-input-wrap">
                  <input
                    type="text"
                    value={query}
                    placeholder="Search docs, frameworks, guides, or domains..."
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowSuggestions(false), 120);
                    }}
                    onKeyDown={handleQueryKeyDown}
                    aria-label="Search query"
                    aria-expanded={showSuggestions}
                    aria-controls="search-suggestions"
                    autoComplete="off"
                  />
                  {showSuggestions &&
                    (visibleSuggestions.length > 0 || suggestionsLoading) && (
                      <div className="suggestions-panel" id="search-suggestions">
                        {suggestionsLoading && (
                          <p className="suggestions-status">
                            Looking up suggestions...
                          </p>
                        )}
                        {!suggestionsLoading &&
                          visibleSuggestions.map((suggestion, index) => (
                            <button
                              key={suggestion}
                              type="button"
                              className={`suggestion-item${
                                selectedSuggestionIndex === index ? " active" : ""
                              }`}
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

              {(submittedQuery || loading) && (
                <div className="search-meta" aria-live="polite">
                  <span>
                    {loading
                      ? "Searching your index..."
                      : `${searchMeta.total} result${searchMeta.total === 1 ? "" : "s"} found`}
                  </span>
                  {!loading && searchMeta.total > 0 && (
                    <span>in {searchMeta.searchTimeMs} ms</span>
                  )}
                </div>
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

              {results.length > 0 && (
                <section className="results-section panel-results">
                  <div className="section-heading">
                    <p className="eyebrow">Results</p>
                    <h2>Browse what your engine found</h2>
                    <p className="results-range">
                      Showing {firstResultIndex}-{lastResultIndex} of {searchMeta.total}
                    </p>
                  </div>

                  <ul className="results-list">
                    {results.map((result) => (
                      <li key={result.url} className="result-card">
                        <a href={result.url} target="_blank" rel="noreferrer">
                          {highlightMatches(result.title, submittedQuery)}
                        </a>
                        <p>{highlightMatches(result.snippet, submittedQuery)}</p>
                        <div className="result-meta">
                          <span>{result.url}</span>
                          <span>Score {result.score}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {searchMeta.totalPages > 1 && (
                    <div className="pagination-bar">
                      <button
                        type="button"
                        onClick={() => handlePageChange(searchMeta.page - 1)}
                        disabled={loading || searchMeta.page === 1}
                      >
                        Previous
                      </button>
                      <span>
                        Page {searchMeta.page} of {searchMeta.totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePageChange(searchMeta.page + 1)}
                        disabled={loading || searchMeta.page === searchMeta.totalPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>
        </div>
      </header>

      <section className="features-row">
        <article className="feature-card">
          <p className="feature-kicker">Coverage</p>
          <h2>{stats.totalDocuments} searchable pages</h2>
          <p>Your search workspace is backed by a real document index instead of static sample content.</p>
        </article>
        <article className="feature-card">
          <p className="feature-kicker">Relevance</p>
          <h2>{stats.uniqueTerms} unique terms</h2>
          <p>Query matching is stronger because the engine can score against a deeper vocabulary set.</p>
        </article>
        <article className="feature-card">
          <p className="feature-kicker">Source Mix</p>
          <h2>{stats.uniqueDomains} indexed domains</h2>
          <p>Results come from multiple indexed sources, giving the product a broader and more useful search surface.</p>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-header">
          <p className="eyebrow">Index Dashboard</p>
          <h2>Monitor the health of your search system</h2>
          <p className="dashboard-subtitle">Last indexed: {formattedIndexedDate}</p>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <p className="dashboard-label">Total pages</p>
            <strong>{stats.totalDocuments}</strong>
          </article>
          <article className="dashboard-card">
            <p className="dashboard-label">Unique terms</p>
            <strong>{stats.uniqueTerms}</strong>
          </article>
          <article className="dashboard-card">
            <p className="dashboard-label">Domains</p>
            <strong>{stats.uniqueDomains}</strong>
          </article>
          <article className="dashboard-card dashboard-list-card">
            <p className="dashboard-label">Top domains</p>
            <ul className="domain-list">
              {stats.topDomains.map((entry) => (
                <li key={entry.domain}>
                  <span>{entry.domain}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

    </div>
  );
}

export default App;
