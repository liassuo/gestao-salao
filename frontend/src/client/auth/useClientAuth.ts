import { useContext } from 'react';
import { ClientAuthContext } from './ClientAuthContext';

export function useClientAuth() {
  const context = useContext(ClientAuthContext);

  if (!context) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }

  return context;
}
