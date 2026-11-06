# AdegaFácil

Sistema web para apoiar a gestão de uma adega, reunindo cadastro de produtos, controle de estoque, vendas, fiados, entregas e relatórios em um só lugar.

## Funcionalidades

- **Produtos e lotes:** cadastro de produtos, preços, estoque mínimo e lotes com validade.
- **Controle FEFO:** nas vendas, o estoque é abatido primeiro do lote válido que vence antes.
- **Venda por unidade ou fardo:** permite configurar unidades por fardo e preço do fardo.
- **Vendas e cancelamentos:** histórico de vendas e cancelamento com registro do motivo. O cancelamento restaura o estoque nos lotes consumidos e estorna o fiado, quando aplicável.
- **Fiados:** acompanhamento de saldos, registro de pagamentos e consulta ao histórico de movimentações.
- **Entregas:** acompanhamento das etapas pendente, em rota e concluída.
- **Usuários e acesso:** autenticação por PIN, com perfis de administrador e operador.
- **Painel e relatórios:** indicadores da operação, vendas, produtos mais vendidos, formas de pagamento e saldo de fiados.

## Tecnologias

- Next.js
- React
- Prisma ORM
- PostgreSQL
- Node.js

## Pré-requisitos

- Node.js e npm instalados.
- Banco de dados PostgreSQL.
- Acesso ao banco configurado no ambiente local.

## Configuração local

1. Acesse a pasta do frontend:

   ```bash
   cd frontend
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Crie o arquivo `frontend/.env` e configure as conexões do banco:

   ```env
   DATABASE_URL="sua_url_de_conexao"
   DIRECT_URL="sua_url_direta_de_conexao"
   ```

   `DATABASE_URL` é usada pela aplicação. `DIRECT_URL` é usada pelo Prisma para operações de migração. Não compartilhe nem envie essas credenciais ao Git.

4. Gere o Prisma Client:

   ```bash
   npx prisma generate
   ```

5. Aplique as migrações:

   ```bash
   npx prisma migrate dev
   ```

6. Execute a seed, se necessário:

   ```bash
   npx prisma db seed
   ```

   A seed exige a configuração de um PIN inicial com seis dígitos. Confira em `prisma/seed.ts` qual variável de ambiente o projeto espera e não inclua o PIN no repositório.

7. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

   A aplicação ficará disponível no endereço local indicado pelo Next.js no terminal.

## Scripts disponíveis

Execute os comandos na pasta `frontend`:

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o ambiente de desenvolvimento |
| `npm run build` | Gera a versão de produção |
| `npm run start` | Inicia a versão de produção |
| `npm run lint` | Executa o ESLint |

## Estrutura principal

```text
frontend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
└── src/
    ├── app/
    │   ├── api/
    │   └── ...
    ├── components/
    └── lib/
```


## Segurança

- Não envie arquivos `.env`, credenciais do banco ou PINs para o repositório.
- Utilize dados fictícios nas demonstrações e evidências.