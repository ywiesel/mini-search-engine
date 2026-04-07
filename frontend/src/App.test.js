import { render, screen } from '@testing-library/react';
import App from './App';

test('renders search heading', async () => {
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          url.includes('/stats')
            ? {
                totalDocuments: 3,
                totalImages: 6,
                uniqueTerms: 120,
                uniqueDomains: 2,
                lastIndexed: 1712500000,
                topDomains: [],
              }
            : url.includes('/relevance')
              ? {
                  weights: {
                    web: {
                      titleWeight: 4,
                      urlWeight: 2,
                      contentWeight: 1,
                      coverageBonus: 3,
                      exactTitleBonus: 6,
                    },
                    images: {
                      altWeight: 5,
                      pageTitleWeight: 3,
                      sourceUrlWeight: 2,
                      imageContentWeight: 1,
                      imageCoverageBonus: 2,
                    },
                  },
                  defaults: {
                    web: {
                      titleWeight: 4,
                      urlWeight: 2,
                      contentWeight: 1,
                      coverageBonus: 3,
                      exactTitleBonus: 6,
                    },
                    images: {
                      altWeight: 5,
                      pageTitleWeight: 3,
                      sourceUrlWeight: 2,
                      imageContentWeight: 1,
                      imageCoverageBonus: 2,
                    },
                  },
                }
              : { suggestions: [] }
        ),
    })
  );

  render(<App />);
  expect(await screen.findByText(/search your own indexed web content/i)).toBeInTheDocument();
  expect(await screen.findByLabelText(/search query/i)).toBeInTheDocument();
});
