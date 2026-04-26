## Frontend

Aplicacao React/Vite para o MVP comercial do Total Control.

### Desenvolvimento local

1. Instale as dependencias:
   `npm install`
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Rode o app:
   `npm run dev`

### Deploy na Vercel

- Root directory do projeto: `Front-end`
- Runtime de build: Node `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Variaveis obrigatorias: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

Exemplo de valores em producao:

`VITE_SUPABASE_URL=https://seu-projeto.supabase.co`

`VITE_SUPABASE_ANON_KEY=seu-anon-key`
