import React, { useState } from "react";
import SearchBar from "./SearchBar";
import Results from "./Results";

export default function App() {
  const [results, setResults] = useState([]);

  const handleSearch = async query => {
    const res = await fetch(`http://localhost:5000/search?q=${query}`);
    const data = await res.json();
    setResults(data.results);
  };

  return (
    <div>
      <h1>Mini Search Engine</h1>
      <SearchBar onSearch={handleSearch} />
      <Results results={results} />
    </div>
  );
}
