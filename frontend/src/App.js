import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const PAGE_SIZE = 5;
const EMPTY_RELEVANCE_SETTINGS = {
  web: {
    titleWeight: 0,
    urlWeight: 0,
    contentWeight: 0,
    coverageBonus: 0,
    exactTitleBonus: 0,
  },
  images: {
    altWeight: 0,
    pageTitleWeight: 0,
    sourceUrlWeight: 0,
    imageContentWeight: 0,
    imageCoverageBonus: 0,
  },
};

const RELEVANCE_FIELDS = {
  web: [
    {
      key: "titleWeight",
      label: "Title weight",
      description: "Boost pages when the query appears in the page title.",
    },
    {
      key: "urlWeight",
      label: "URL weight",
      description: "Boost pages when the query appears in the page URL.",
    },
    {
      key: "contentWeight",
      label: "Content weight",
      description: "Control how much repeated mentions in body text matter.",
    },
    {
      key: "coverageBonus",
      label: "Coverage bonus",
      description: "Reward pages that match more of the query terms.",
    },
    {
      key: "exactTitleBonus",
      label: "Exact title bonus",
      description: "Give extra points when the full query appears in the title.",
    },
  ],
  images: [
    {
      key: "altWeight",
      label: "Alt text weight",
      description: "Boost images whose alt text matches the query.",
    },
    {
      key: "pageTitleWeight",
      label: "Page title weight",
      description: "Boost images from pages with matching titles.",
    },
    {
      key: "sourceUrlWeight",
      label: "Source URL weight",
      description: "Boost images whose source page URL matches the query.",
    },
    {
      key: "imageContentWeight",
      label: "Image content weight",
      description: "Control term frequency impact across image metadata.",
    },
    {
      key: "imageCoverageBonus",
      label: "Image coverage bonus",
      description: "Reward images matching more query terms.",
    },
  ],
};

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
  const [searchMode, setSearchMode] = useState("text");
  const [activeView, setActiveView] = useState("search");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [relevanceSaving, setRelevanceSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [error, setError] = useState("");
  const [relevanceError, setRelevanceError] = useState("");
  const [relevanceMessage, setRelevanceMessage] = useState("");
  const [searchMeta, setSearchMeta] = useState({
    total: 0,
    searchTimeMs: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalImages: 0,
    uniqueTerms: 0,
    uniqueDomains: 0,
    lastIndexed: null,
    topDomains: [],
  });
  const [relevanceDefaults, setRelevanceDefaults] = useState(
    EMPTY_RELEVANCE_SETTINGS
  );
  const [relevanceSettings, setRelevanceSettings] = useState(
    EMPTY_RELEVANCE_SETTINGS
  );

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
            totalImages: 0,
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

    const fetchRelevance = async () => {
      setRelevanceLoading(true);
      setRelevanceError("");

      try {
        const res = await fetch(`${apiBaseUrl}/relevance`);
        if (!res.ok) {
          throw new Error(`Relevance request failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!ignore) {
          setRelevanceDefaults(data.defaults || EMPTY_RELEVANCE_SETTINGS);
          setRelevanceSettings(data.weights || EMPTY_RELEVANCE_SETTINGS);
        }
      } catch (err) {
        if (!ignore) {
          setRelevanceError("Relevance settings are unavailable right now.");
          setRelevanceDefaults(EMPTY_RELEVANCE_SETTINGS);
          setRelevanceSettings(EMPTY_RELEVANCE_SETTINGS);
        }
      } finally {
        if (!ignore) {
          setRelevanceLoading(false);
        }
      }
    };

    fetchRelevance();

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

  const runSearch = async (nextQuery, nextPage = 1, nextMode = searchMode) => {
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
        `${apiBaseUrl}/search?q=${encodeURIComponent(normalizedQuery)}&page=${nextPage}&page_size=${PAGE_SIZE}&mode=${encodeURIComponent(nextMode)}`
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

  const handleModeChange = async (nextMode) => {
    if (nextMode === searchMode) {
      return;
    }

    setSearchMode(nextMode);

    const activeQuery = (submittedQuery || query).trim();
    if (activeQuery) {
      await runSearch(activeQuery, 1, nextMode);
    } else {
      setResults([]);
      setSearchMeta({
        total: 0,
        searchTimeMs: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 0,
      });
    }
  };

  const handleRelevanceChange = (section, key, value) => {
    setRelevanceMessage("");
    setRelevanceSettings((currentSettings) => ({
      ...currentSettings,
      [section]: {
        ...currentSettings[section],
        [key]: Number(value),
      },
    }));
  };

  const handleSaveRelevance = async () => {
    setRelevanceSaving(true);
    setRelevanceError("");
    setRelevanceMessage("");

    try {
      const res = await fetch(`${apiBaseUrl}/relevance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ weights: relevanceSettings }),
      });
      if (!res.ok) {
        throw new Error(`Relevance save failed with status ${res.status}`);
      }

      const data = await res.json();
      setRelevanceDefaults(data.defaults || EMPTY_RELEVANCE_SETTINGS);
      setRelevanceSettings(data.weights || EMPTY_RELEVANCE_SETTINGS);
      setRelevanceMessage("Ranking weights saved.");
    } catch (err) {
      setRelevanceError("Could not save relevance settings.");
    } finally {
      setRelevanceSaving(false);
    }
  };

  const handleResetRelevance = () => {
    setRelevanceError("");
    setRelevanceMessage("");
    setRelevanceSettings(relevanceDefaults);
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
  const searchPlaceholder =
    searchMode === "images"
      ? "Search indexed images by alt text, page title, or URL..."
      : "Search docs, frameworks, guides, or domains...";
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
            <button
              type="button"
              className={activeView === "search" ? "active" : ""}
              onClick={() => setActiveView("search")}
            >
              Search Workspace
            </button>
            <button
              type="button"
              className={activeView === "relevance" ? "active" : ""}
              onClick={() => setActiveView("relevance")}
            >
              Relevance
            </button>
            <button
              type="button"
              className={activeView === "analytics" ? "active" : ""}
              onClick={() => setActiveView("analytics")}
            >
              Analytics
            </button>
          </div>
        </nav>
        {activeView === "search" ? (
          <>
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

                  <div className="search-mode-switch" role="tablist" aria-label="Search type">
                    <button
                      type="button"
                      className={`mode-chip${searchMode === "text" ? " active" : ""}`}
                      onClick={() => handleModeChange("text")}
                    >
                      Web
                    </button>
                    <button
                      type="button"
                      className={`mode-chip${searchMode === "images" ? " active" : ""}`}
                      onClick={() => handleModeChange("images")}
                    >
                      Images
                    </button>
                  </div>

                  <form className="search-form" onSubmit={handleSearch}>
                    <div className="search-input-wrap">
                      <input
                        type="text"
                        value={query}
                        placeholder={searchPlaceholder}
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
                      {searchMode === "images"
                        ? stats.totalImages === 0
                          ? `No indexed images are available yet. Re-run the crawler with network access, then try "${query.trim()}" again.`
                          : `No image results found for "${query.trim()}". Re-run the crawler to index more page images.`
                        : `No results found for "${query.trim()}".`}
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
                        <p className="eyebrow">{searchMode === "images" ? "Image Results" : "Results"}</p>
                        <h2>
                          {searchMode === "images"
                            ? "Browse indexed images from your search data"
                            : "Browse what your engine found"}
                        </h2>
                        <p className="results-range">
                          Showing {firstResultIndex}-{lastResultIndex} of {searchMeta.total}
                        </p>
                      </div>

                      {searchMode === "images" ? (
                        <ul className="image-results-grid">
                          {results.map((result) => (
                            <li key={result.imageUrl} className="image-card">
                              <a href={result.sourcePage} target="_blank" rel="noreferrer">
                                <img
                                  src={result.imageUrl}
                                  alt={result.title}
                                  loading="lazy"
                                />
                              </a>
                              <div className="image-card-body">
                                <a href={result.sourcePage} target="_blank" rel="noreferrer">
                                  {highlightMatches(result.title, submittedQuery)}
                                </a>
                                <p>{highlightMatches(result.pageTitle, submittedQuery)}</p>
                                <div className="result-meta">
                                  <span>{result.sourcePage}</span>
                                  <span>Score {result.score}</span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
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
                      )}

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
          </>
        ) : activeView === "relevance" ? (
          <section className="relevance-view">
            <div className="dashboard-header">
              <p className="eyebrow">Relevance Controls</p>
              <h2>Tune how your search engine ranks pages and images</h2>
              <p className="dashboard-subtitle">
                Adjust the scoring weights below, then save to make future searches use
                the new ranking rules.
              </p>
            </div>

            {relevanceLoading ? (
              <p className="status-message">Loading relevance controls...</p>
            ) : (
              <>
                {relevanceError && (
                  <p className="status-message error">{relevanceError}</p>
                )}
                {relevanceMessage && (
                  <p className="status-message success">{relevanceMessage}</p>
                )}

                <div className="relevance-grid">
                  <article className="dashboard-card relevance-card">
                    <p className="dashboard-label">Web Ranking</p>
                    <h3>Page search weights</h3>
                    <div className="relevance-controls">
                      {RELEVANCE_FIELDS.web.map((field) => (
                        <label key={field.key} className="relevance-control">
                          <div className="relevance-control-copy">
                            <span>{field.label}</span>
                            <small>{field.description}</small>
                          </div>
                          <div className="relevance-input-row">
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="1"
                              value={relevanceSettings.web[field.key]}
                              onChange={(event) =>
                                handleRelevanceChange("web", field.key, event.target.value)
                              }
                            />
                            <strong>{relevanceSettings.web[field.key]}</strong>
                          </div>
                        </label>
                      ))}
                    </div>
                  </article>

                  <article className="dashboard-card relevance-card">
                    <p className="dashboard-label">Image Ranking</p>
                    <h3>Image search weights</h3>
                    <div className="relevance-controls">
                      {RELEVANCE_FIELDS.images.map((field) => (
                        <label key={field.key} className="relevance-control">
                          <div className="relevance-control-copy">
                            <span>{field.label}</span>
                            <small>{field.description}</small>
                          </div>
                          <div className="relevance-input-row">
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="1"
                              value={relevanceSettings.images[field.key]}
                              onChange={(event) =>
                                handleRelevanceChange(
                                  "images",
                                  field.key,
                                  event.target.value
                                )
                              }
                            />
                            <strong>{relevanceSettings.images[field.key]}</strong>
                          </div>
                        </label>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="relevance-actions">
                  <button
                    type="button"
                    className="primary-action"
                    onClick={handleSaveRelevance}
                    disabled={relevanceSaving}
                  >
                    {relevanceSaving ? "Saving..." : "Save weights"}
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={handleResetRelevance}
                    disabled={relevanceSaving}
                  >
                    Reset draft
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="analytics-view">
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
                <p className="dashboard-label">Images</p>
                <strong>{stats.totalImages}</strong>
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
        )}
      </header>

    </div>
  );
}

export default App;
