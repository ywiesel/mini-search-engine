import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const PAGE_SIZE = 5;
const DEFAULT_PREFERENCES = {
  theme: "airy",
  density: "comfortable",
  shape: "soft",
  homepage: "search",
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [error, setError] = useState("");
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [hasAppliedHomepagePreference, setHasAppliedHomepagePreference] =
    useState(false);
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
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

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
    try {
      const savedPreferences = window.localStorage.getItem("northstar-preferences");
      if (savedPreferences) {
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...JSON.parse(savedPreferences),
        });
      }
    } catch (err) {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "northstar-preferences",
      JSON.stringify(preferences)
    );
  }, [preferences]);

  useEffect(() => {
    if (hasAppliedHomepagePreference) {
      return;
    }

    setActiveView(preferences.homepage === "activity" ? "analytics" : "search");
    setHasAppliedHomepagePreference(true);
  }, [hasAppliedHomepagePreference, preferences.homepage]);

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

  const handlePreferenceChange = (key, value) => {
    setPreferencesMessage("Your look and feel has been updated.");
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      [key]: value,
    }));
  };

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    setPreferencesMessage("Preferences reset to the default look.");
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
      ? "Try cats, sunsets, recipes, or a website name..."
      : "Try a topic, question, or website name...";
  const formattedIndexedDate = stats.lastIndexed
    ? new Date(stats.lastIndexed * 1000).toLocaleString()
    : "Unavailable";
  const appClassName = [
    "app-shell",
    `theme-${preferences.theme}`,
    `density-${preferences.density}`,
    `shape-${preferences.shape}`,
  ].join(" ");

  return (
    <div className={appClassName}>
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
              Search
            </button>
            <button
              type="button"
              className={activeView === "preferences" ? "active" : ""}
              onClick={() => setActiveView("preferences")}
            >
              Preferences
            </button>
            <button
              type="button"
              className={activeView === "analytics" ? "active" : ""}
              onClick={() => setActiveView("analytics")}
            >
              Activity
            </button>
          </div>
        </nav>
        {activeView === "search" ? (
          <>
            <div className="hero-grid">
              <section className="hero-copy">
                <p className="eyebrow">Simple Search</p>
                <h1>Find what you want without overthinking it.</h1>
                <p className="subtitle">
                  Type in something you are curious about and explore the pages or
                  pictures that match. The experience is meant to feel easy, calm,
                  and familiar from the start.
                </p>

                <div className="hero-actions">
                  <span className="hero-pill">Easy to try</span>
                  <span className="hero-pill">Clear results</span>
                  <span className="hero-pill">No jargon</span>
                </div>
              </section>

              <section className="hero-panel">
                <div className="panel-card">
                  <p className="panel-label">Start here</p>
                  <p className="panel-intro">
                    Search by word, topic, or site name. You can switch between web
                    pages and images anytime.
                  </p>

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
                        role="combobox"
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
                        aria-autocomplete="list"
                        aria-expanded={showSuggestions}
                        aria-haspopup="listbox"
                        aria-controls="search-suggestions"
                        autoComplete="off"
                      />
                      {showSuggestions &&
                        (visibleSuggestions.length > 0 || suggestionsLoading) && (
                          <div
                            className="suggestions-panel"
                            id="search-suggestions"
                            role="listbox"
                          >
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
                    <span>Try one:</span>
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
                            ? "Pictures that match your search"
                            : "Pages that match your search"}
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
        ) : activeView === "preferences" ? (
          <section className="preferences-view">
            <div className="dashboard-header">
              <p className="eyebrow">Your Style</p>
              <h2>Make the search experience feel better for you</h2>
              <p className="dashboard-subtitle">
                Pick the look that feels easiest on your eyes. These choices stay on
                your device and change how the site appears for you.
              </p>
            </div>

            {preferencesMessage && (
              <p className="status-message success">{preferencesMessage}</p>
            )}

            <div className="preferences-grid">
              <article className="dashboard-card preference-card">
                <p className="dashboard-label">Color Feel</p>
                <h3>Choose a mood</h3>
                <div className="preference-options">
                  <button
                    type="button"
                    className={`preference-option${preferences.theme === "airy" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("theme", "airy")}
                  >
                    <strong>Airy</strong>
                    <span>Bright, light, and open.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.theme === "warm" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("theme", "warm")}
                  >
                    <strong>Warm</strong>
                    <span>Softer tones with a cozy feel.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.theme === "calm" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("theme", "calm")}
                  >
                    <strong>Calm</strong>
                    <span>Cooler contrast for a steadier look.</span>
                  </button>
                </div>
              </article>

              <article className="dashboard-card preference-card">
                <p className="dashboard-label">Spacing</p>
                <h3>Choose your reading pace</h3>
                <div className="preference-options">
                  <button
                    type="button"
                    className={`preference-option${preferences.density === "compact" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("density", "compact")}
                  >
                    <strong>Compact</strong>
                    <span>Fit more on the screen at once.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.density === "comfortable" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("density", "comfortable")}
                  >
                    <strong>Comfortable</strong>
                    <span>A balanced amount of breathing room.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.density === "spacious" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("density", "spacious")}
                  >
                    <strong>Spacious</strong>
                    <span>More room between sections and results.</span>
                  </button>
                </div>
              </article>

              <article className="dashboard-card preference-card">
                <p className="dashboard-label">Card Style</p>
                <h3>Choose a shape</h3>
                <div className="preference-options">
                  <button
                    type="button"
                    className={`preference-option${preferences.shape === "soft" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("shape", "soft")}
                  >
                    <strong>Soft</strong>
                    <span>Rounded corners and a gentle feel.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.shape === "balanced" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("shape", "balanced")}
                  >
                    <strong>Balanced</strong>
                    <span>Clean and modern without feeling sharp.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.shape === "crisp" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("shape", "crisp")}
                  >
                    <strong>Crisp</strong>
                    <span>More structure with tighter corners.</span>
                  </button>
                </div>
              </article>

              <article className="dashboard-card preference-card">
                <p className="dashboard-label">Start Page</p>
                <h3>Choose what opens first</h3>
                <div className="preference-options">
                  <button
                    type="button"
                    className={`preference-option${preferences.homepage === "search" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("homepage", "search")}
                  >
                    <strong>Search</strong>
                    <span>Jump right into looking things up.</span>
                  </button>
                  <button
                    type="button"
                    className={`preference-option${preferences.homepage === "activity" ? " active" : ""}`}
                    onClick={() => handlePreferenceChange("homepage", "activity")}
                  >
                    <strong>Activity</strong>
                    <span>Open with your search overview first.</span>
                  </button>
                </div>
              </article>
            </div>

            <div className="relevance-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleResetPreferences}
              >
                Reset look
              </button>
            </div>
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
