# Lojinha Lofi

Jogo cozy de gerenciamento de loja (Vue 3 + Three.js + Vite).

```bash
npm install
npm run dev      # http://localhost:5199
```

## Como jogar
Cada dia: **preparação** (tempo livre) → **loja aberta** (15 min reais = 09h–21h) → **fim do dia** (resumo + pedidos).
Entrega chegou? Clique nas caixas: **receber** (calçada) → **desembalar** (estoque) → clique na caixa aberta e depois
numa prateleira para **repor** → clique na prateleira para **precificar**. Clique no balcão para atender o caixa.
Em **🏪 Loja**: comprar prateleiras, ampliar o espaço, contratar caixa e repositores. Em **📦 Pedidos**: comprar caixas
(chegam na manhã seguinte) e abrir novos fornecedores. O jogo salva ao começar cada dia.

## Assets da Kenney (CC0)
Baixe em kenney.nl: **Furniture Kit**, **Food Kit** e **Mini Characters** (ou Blocky Characters). Coloque os `.zip` em
`assets-src/` e rode `npm run assets` (extrai os `.glb` para `public/assets/kenney/`). Sem os arquivos, o jogo usa
modelos procedurais. Os nomes de arquivo esperados ficam em `src/game/assets.js` e `src/game/config.js` (campo `model`).
