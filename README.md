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
| `npm test` | Executa os testes unitários com Vitest |

## Estrutura principal

```text
frontend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
└── src/
    ├── app/
    │   ├── api/
    │   ├── components/
    │   ├── fiados/
    │   │   └── components/CreditHistory.js
    │   ├── produtos/
    │   │   └── components/ProductTable.js
    │   └── vendas/
    │       └── components/SalesHistory.js
    └── lib/
        ├── sales/fefo.js
        ├── api-auth.js
        ├── dates.js
        ├── formatters.js
        └── money.js
```

As páginas continuam responsáveis pelo estado da interface, carregamento de dados,
formulários, filtragem e ações de cada módulo. As rotas da API continuam concentrando
as transações Prisma, validações, permissões e contratos de resposta. As extrações
realizadas não movem toda a lógica de negócio para serviços: elas isolam apenas regras
ou trechos de apresentação que podem ser reutilizados e testados sem alterar o fluxo
existente.

Entre as refatorações atuais:

- A regra FEFO usada no registro de vendas está em `src/lib/sales/fefo.js`, com testes
  unitários em `fefo.test.js`. A função mantém a seleção de lotes válidos, a ordem por
  vencimento e criação, o tratamento de lotes sem validade, a divisão da quantidade e
  o erro para estoque válido insuficiente.
- `src/lib/money.js`, `src/lib/formatters.js` e `src/lib/dates.js` centralizam,
  respectivamente, a conversão para centavos, a formatação de moeda e a formatação
  de datas no fuso local. Cada comportamento compartilhado possui testes unitários
  quando aplicável.
- `src/lib/api-auth.js` fornece a resposta padrão de autenticação para rotas
  protegidas, enquanto as verificações específicas de perfil, permissões e respostas
  `403` permanecem nas próprias rotas.
- `CreditHistory`, `SalesHistory` e `ProductTable` são componentes de apresentação
  extraídos das páginas de fiados, vendas e produtos. Estados, carregamento, ações,
  busca, filtragem e regras específicas continuam nas páginas correspondentes.


## Segurança

- Não envie arquivos `.env`, credenciais do banco ou PINs para o repositório.

## Acessibilidade

Foram implementadas melhorias de acessibilidade nas telas da aplicação:

- Adicionado o atalho “Pular para o conteúdo”, com foco no conteúdo principal.
- Incluído um único landmark `<main>` nas telas autenticadas, mantendo o login fora do `AppShell`.
- Adicionado foco visível para links, botões, campos, selects, textareas e elementos `summary`.
- Ajustado o contraste do indicador de foco e do status verde para atender aos requisitos de contraste verificados.
- Mantidos rótulos associados aos campos e adicionadas instruções para os campos de PIN.
- Adicionadas legendas descritivas às tabelas de usuários e movimentações de fiados.
- Estados de carregamento relevantes são anunciados com `role="status"`.
- Validações locais do formulário de vendas associam os erros aos campos relacionados, aplicam `aria-invalid` somente durante o erro e levam o foco ao primeiro campo envolvido.
- O erro específico de redefinição de PIN em Usuários é associado ao campo da linha correspondente; erros gerais continuam em `role="alert"`.
- Mensagens de sucesso continuam em `role="status"` e não recebem foco automático.

As verificações automatizadas realizadas foram `npm test`, `npm run lint` e `npm run build` na pasta `frontend`. O `npm test` verificou 18 testes passando. O lint apresentou apenas warnings preexistentes nos arquivos gerados do Prisma, e o build apresentou warnings preexistentes do Next.js/Prisma.

O autor também realizou verificação manual de navegação por teclado, leitor de tela e zoom. Essa verificação documenta os cenários conferidos, mas não certifica conformidade total com WCAG 2.2 AA.

## Acesso à aplicação

A aplicação está publicada na Vercel:

[Acessar o AdegaFácil](https://adega-facil-pi.vercel.app)

## Infraestrutura em nuvem

- **Aplicação web e API:** Vercel
- **Banco de dados PostgreSQL:** Neon