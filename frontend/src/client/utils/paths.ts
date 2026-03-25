const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

// É o domínio do cliente se for barbeariaamerica.com.br (não admin.)
// Para testes locais, defina VITE_APP_MODE=client no .env
export const IS_CLIENT_DOMAIN =
  hostname === 'barbeariaamerica.com.br' ||
  hostname === 'www.barbeariaamerica.com.br' ||
  import.meta.env.VITE_APP_MODE === 'client';

export const CLIENT_PATHS = {
  home: IS_CLIENT_DOMAIN ? '/' : '/cliente',
  login: IS_CLIENT_DOMAIN ? '/login' : '/cliente/login',
  agendar: IS_CLIENT_DOMAIN ? '/agendar' : '/cliente/agendar',
  perfil: IS_CLIENT_DOMAIN ? '/perfil' : '/cliente/perfil',
  criarSenha: IS_CLIENT_DOMAIN ? '/criar-senha' : '/cliente/criar-senha',
  planos: IS_CLIENT_DOMAIN ? '/planos' : '/cliente/planos',
  esqueceuSenha: IS_CLIENT_DOMAIN ? '/esqueceu-senha' : '/cliente/esqueceu-senha',
  recuperarSenha: IS_CLIENT_DOMAIN ? '/recuperar-senha' : '/cliente/recuperar-senha',
};
