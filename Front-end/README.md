## Frontend

Aplicacao React/Vite para o MVP comercial do Total Control.

### Desenvolvimento local

Fluxo recomendado com Supabase local:

1. Na raiz do workspace, suba o stack local:
   `npm run supabase:start`
2. Gere `Front-end/.env.local` com as credenciais locais:
   `npm run supabase:env`
3. Instale as dependencias:
   `npm install`
4. Rode o app:
   `npm run dev`

Porta local padrao do frontend:

`http://127.0.0.1:3000`

O script `npm run dev` fixa host e porta para alinhar com o `site_url` e os redirect URLs do Supabase local.

### Deploy na Vercel

- Root directory do projeto: `Front-end`
- URL inicial de producao: `https://total-control-app.vercel.app`
- Runtime de build: Node `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Variaveis obrigatorias: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Fluxo de acesso em producao:
  - primeiro cadastro publico apenas para bootstrap do admin inicial
  - depois disso, novos usuarios entram por convite

Exemplo de valores em producao:

`VITE_SUPABASE_URL=https://seu-projeto.supabase.co`

`VITE_SUPABASE_ANON_KEY=seu-anon-key`
