import React from "react";

export default function Results({ results }) {
  return (
    <ul>
      {results.map((r, i) => (
        <li key={i}>
          <h3>{r.title}</h3>
          <p>{r.snippet}</p>
          <a href={r.url}>{r.url}</a>
        </li>
      ))}
    </ul>
  );
}
