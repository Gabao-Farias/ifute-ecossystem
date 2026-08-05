Precisamos atualizar a pagina https://ifute.com.br/business especificamente na seção de indicações...

Precisamos estratégias e formas de aumentar o engajamento nesta página, talvez criando uma nova página nova em https://ifute.com.br/partners ou /affiliates, ou algo do tipo...

Onde nesta pagina nova teria o Simulador de Rendimento, assim como ja existe no backoffice em https://backoffice.ifute.com.br/dashboard/affiliates

E tambem incluindo o email de contato na pagina ifuteoficialbrasil@gmail.com 

Estas foram algumas ideias que pensei que poderiam melhorar o engajamento e ate a apresentacao do produto, se tiver mais alguma sugestao ou alinhamento, so comentar.

---

## Resultado (implementado em `ifute-landing-page`)

Decisões: rota canônica **`/partners`** (consistente com `/business`), com redirect 301 de
`/parceiros`, `/affiliates` e `/afiliados`. O link de indicação **continua sendo o do backoffice**
(`backoffice.ifute.com.br/login?ref=CÓDIGO`) — a landing não captura `?ref=`.

### O que foi feito

- **Nova página `/partners`** (`src/app/partners/page.tsx`): hero com a proposta (20% para sempre),
  faixa de números (comissão por hora, vínculo sem prazo, custo R$ 0), "Como funciona" em 3 passos,
  bloco "A conta, aberta" abrindo a matemática da comissão, simulador, "Por que essa renda é
  diferente", "Regras claras" (comissão travada na compra, indicação direta sem níveis, vínculo
  imutável, transparência no painel), FAQ e CTA final com o e-mail de contato
  (`ifuteoficialbrasil@gmail.com`, com `subject` pré-preenchido).
- **Simulador de rendimento na landing** (`src/components/site/earnings-simulator.tsx`): porte do
  componente do backoffice (`components/affiliate/earnings-simulator`), mesmas premissas
  (bloco de 30 min, 30 dias/mês) e mesmo arredondamento do backend (floor em centavos), incluindo a
  comparação com CDB e o bloco "Como calculamos".
- **Constantes do programa em `src/lib/site.ts`** (`affiliate`, `commissionPerBlockCents`) espelhando
  `BusinessConfig` — o endpoint real (`/private/businessConfig`) é autenticado, então a landing não
  consegue buscar em runtime. **Se a taxa (R$ 4,99) ou o percentual (20%) mudarem no banco, atualizar
  esse bloco.**
- **`/business` enxugada**: a seção `#afiliados` virou teaser com CTA "Ver simulador de rendimento"
  apontando para `/partners`, em vez de repetir o conteúdo.
- **Navegação**: item "Parceiros" no header da variante business, nova variante `partners` no header
  (nav própria + CTA "Pegar meu link"), links "Programa de parceiros" e "Simulador de rendimento" no
  rodapé, e o e-mail do rodapé virou `mailto:`.
- **SEO**: JSON-LD de FAQ passou a ser **por página** (antes o layout injetava o FAQ do jogador em
  todas as rotas, inclusive `/business`); `/partners` tem `FAQPage` próprio, metadata/canonical e já
  entrou no `sitemap.xml`.

### Deploy

Versão do `package.json` bumpada para **0.1.0**. Falta rodar, de dentro de `ifute-compose/`:
`./scripts/release.sh ifute-landing-page` (e `nginx -s reload` no host, pelo DNS defasado do nginx
após recriar o container).

