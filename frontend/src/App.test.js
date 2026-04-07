import { render, screen } from '@testing-library/react';
import App from './App';

test('renders search heading', () => {
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          url.includes('/stats')
            ? {
                totalDocuments: 3,
                uniqueTerms: 120,
                uniqueDomains: 2,
                lastIndexed: 1712500000,
                topDomains: [],
              }
            : { suggestions: [] }
        ),
    })
  );

  render(<App />);
  expect(screen.getByText(/search your own indexed web content/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/search query/i)).toBeInTheDocument();
});
