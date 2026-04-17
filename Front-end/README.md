## Frontend

Aplicação React/Vite para o MVP comercial do Total Control.

### Desenvolvimento local

1. Instale as dependências:
   `npm install`
2. Configure `VITE_API_BASE_URL` se o backend não estiver em `http://127.0.0.1:4000`
3. Rode o app:
   `npm run dev`

### Deploy na Vercel

- Root directory do projeto: `Front-end`
- Runtime de build: Node `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Variável obrigatória: `VITE_API_BASE_URL`

Exemplo de valor em produção:

`VITE_API_BASE_URL=https://api.seu-dominio.com`
