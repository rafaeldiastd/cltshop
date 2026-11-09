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

## Assets e créditos
Todos os assets abaixo são CC0 (domínio público) e já estão em `public/assets/kenney/`.

| Pasta | Pacote | Autor | Link |
|---|---|---|---|
| `shop/` | Mini Shop | Kenney | https://kenney.nl/assets/mini-shop |
| `food/` | Food Kit | Kenney | https://kenney.nl/assets/food-kit |
| `characters/` | Blocky Characters | Kenney | https://kenney.nl/assets/blocky-characters |
| `cars/` | Car Kit | Kenney | https://kenney.nl/assets/car-kit |
| `pets/` | Cube Pets | Kenney | https://kenney.nl/assets/cube-pets |
| `nature/` | Stylized Nature MegaKit (versão Standard/grátis) | Quaternius | https://quaternius.com |

Os modelos usados e seus nomes ficam em `src/game/assets.js` e no campo `model` de `src/game/config.js`.
Se um arquivo faltar, o jogo usa um modelo procedural no lugar.
