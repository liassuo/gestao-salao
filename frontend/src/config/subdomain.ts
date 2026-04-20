/**
 * Detecta se o hostname atual é do painel administrativo.
 *
 * Admin: admin.barbeariaamerica.com.br  (ou localhost para dev)
 * Cliente: barbeariaamerica.com.br (ou qualquer outro host)
 */
export function isAdminHost(): boolean {
  const hostname = window.location.hostname;

  // Em desenvolvimento local, tratar como admin por padrão
  // Para testar o portal do cliente localmente, use: client.localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  // client.localhost para testar portal do cliente localmente
  if (hostname === 'client.localhost') {
    return false;
  }

  // Em produção: admin.* = admin, qualquer outro = cliente
  return hostname.startsWith('admin.');
}
