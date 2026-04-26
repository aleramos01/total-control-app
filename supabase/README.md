## Supabase

Estrutura local para a migracao do Total Control para Supabase.

### O que existe aqui

- `migrations/`: schema, seeds iniciais e politicas de RLS
- `functions/register-with-invite`: cadastro com convite e bootstrap do primeiro admin
- `functions/create-invite`: criacao de convites por admin
- `functions/import-data`: importacao de categorias e transacoes

### Segredos necessarios nas Edge Functions

- `SUPABASE_SERVICE_ROLE_KEY`

### Variaveis do frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Ordem recomendada de aplicacao

1. Aplicar a migration em `migrations/`
2. Publicar as Edge Functions
3. Configurar o segredo `SUPABASE_SERVICE_ROLE_KEY`
4. Configurar as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel
