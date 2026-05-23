import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ProtectedRoute from '../components/common/ProtectedRoute';

const renderWithAuth = (user) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated', () => {
    renderWithAuth({ username: 'alice' });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when user is null', () => {
    renderWithAuth(null);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is undefined', () => {
    renderWithAuth(undefined);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
