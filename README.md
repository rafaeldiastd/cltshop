# Lojinha Lofi

Jogo cozy de gerenciamento de loja (Vue 3 + Three.js + Vite).

```bash
npm install
npm run dev      # http://localhost:5199
```

## Como jogar
Cada dia: **preparação** (tempo livre) → **loja aberta** (15 min reais = 09h–21h) → **fim do dia** (resumo + pedidos).
Entrega chegou? Clique nas caixas: **receber** (calçada) → **desembalar** (sala do estoque) → clique na caixa aberta e depois
numa prateleira para **repor** → clique na prateleira para **precificar**. A caixa que esvazia fica na mão: dá para jogar fora, guardar no estoque ou usar para retirar itens de uma prateleira. Para começar o dia, **abra a loja na porta**.
Com a loja aberta, clique no caixa para atender; com ela fechada, o caixa abre o **modo layout** para mudar os móveis de lugar.
No **computador** da loja ficam as compras (chegam na manhã seguinte) e novos fornecedores, além de prateleiras, ampliação do espaço (o estoque cresce junto) e equipe. O preço de venda é definido na própria prateleira.
No **rádio** ficam o lofi, o volume e sua música (vídeo ou playlist do YouTube, ou playlist do Spotify). Em **Menu** ficam personagem, pet, dados dos clientes, histórico de notificações e controles.
O progresso é salvo automaticamente no navegador.

## Assets e créditos
Todos os assets abaixo são CC0 (domínio público) e já estão em `public/assets/kenney/`.

| Pasta | Pacote | Autor | Link |
|---|---|---|---|
| `shop/` | Mini Shop | Kenney | https://kenney.nl/assets/mini-shop |
| `food/` | Food Kit | Kenney | https://kenney.nl/assets/food-kit |
| `cars/` | Car Kit | Kenney | https://kenney.nl/assets/car-kit |
| `pets/` | Cube Pets | Kenney | https://kenney.nl/assets/cube-pets |
| `nature/` | Stylized Nature MegaKit (versão Standard/grátis) | Quaternius | https://quaternius.com |

Os modelos usados e seus nomes ficam em `src/game/assets.js` e no campo `model` de `src/game/config.js`.
Se um arquivo faltar, o jogo usa um modelo procedural no lugar.
