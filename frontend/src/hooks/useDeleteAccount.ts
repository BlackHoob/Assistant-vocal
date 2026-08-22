import { useApi } from './useApi';
import { useAuth } from './useAuth';

export function useDeleteAccount() {
  const api = useApi();
  const { logout } = useAuth();

  return async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible."
    );
    if (!confirmed) return;

    await api.del('/profile');
    logout();
    window.location.href = '/login';
  };
}