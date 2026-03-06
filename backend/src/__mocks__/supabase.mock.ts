/**
 * Mock chainable para o SupabaseService.
 * Cada método retorna `this` para encadear, exceto os terminadores
 * (single, execute) que retornam { data, error, count }.
 */
export function createSupabaseMock() {
  const mock: any = {
    _result: { data: null, error: null, count: null },

    /** Define o que os terminadores vão retornar */
    setResult(data: any, error: any = null) {
      mock._result = { data, error, count: null };
      return mock;
    },

    setCountResult(count: number) {
      mock._result = { data: null, error: null, count };
      return mock;
    },

    // Query builder methods — all return `this`
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockImplementation(() => mock),
    insert: jest.fn().mockImplementation(() => mock),
    update: jest.fn().mockImplementation(() => mock),
    delete: jest.fn().mockImplementation(() => mock),
    eq: jest.fn().mockImplementation(() => mock),
    neq: jest.fn().mockImplementation(() => mock),
    in: jest.fn().mockImplementation(() => mock),
    or: jest.fn().mockImplementation(() => mock),
    gte: jest.fn().mockImplementation(() => mock),
    lte: jest.fn().mockImplementation(() => mock),
    order: jest.fn().mockImplementation(() => mock),
    limit: jest.fn().mockImplementation(() => mock),

    // Terminadores
    single: jest.fn().mockImplementation(() => Promise.resolve(mock._result)),

    // Para queries sem .single() o Supabase retorna implicitamente
    // Usamos then() para tornar o mock "thenable"
    then: jest.fn().mockImplementation((resolve: any) => resolve(mock._result)),

    // Storage mock
    client: {
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
    },
  };

  return mock;
}

/**
 * Cria um mock de SupabaseService que pode ter resultados configurados por tabela.
 * Uso: mockSupabase.onTable('clients').setResult({...})
 */
export function createTableAwareSupabaseMock() {
  const tables: Record<string, ReturnType<typeof createSupabaseMock>> = {};
  const defaultMock = createSupabaseMock();

  const supabaseMock: any = {
    from: jest.fn().mockImplementation((table: string) => {
      if (!tables[table]) {
        tables[table] = createSupabaseMock();
      }
      // Chamamos from no mock da tabela para registrar a chamada
      tables[table].from(table);
      return tables[table];
    }),

    onTable(table: string) {
      if (!tables[table]) {
        tables[table] = createSupabaseMock();
      }
      return tables[table];
    },

    client: defaultMock.client,
  };

  return supabaseMock;
}
