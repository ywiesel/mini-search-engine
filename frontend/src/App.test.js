import { render, screen } from '@testing-library/react';
import App from './App';

test('renders search heading', () => {
  render(<App />);
  expect(screen.getByText(/search your indexed pages/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/search query/i)).toBeInTheDocument();
});
