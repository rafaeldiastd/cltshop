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
No **computador** da loja ficam as compras (chegam na manhã seguinte), prateleiras, freezers, modo construção (preço por m², com o tamanho limitado pelo tipo de comércio), equipe e decoração. O preço de venda é definido na própria prateleira.
Atender clientes, fazer entregas e cumprir as **metas do dia** (três por dia, no topo da tela) rende experiência. Cada nível dá um ponto de maestria e uma recompensa no **Passe** do computador: os novos fornecedores e alguns bônus em dinheiro são liberados assim.
Na **Equipe** do computador há um catálogo de candidatos, cada um com competência, velocidade e o salário que pede. Os funcionários sobem de nível trabalhando, cansam ao longo do expediente (o almoço e o pet ajudam) e, de vez em quando, pedem aumento, folga, curso ou equipamento. Quem fica muito insatisfeito pede demissão.
O motor dos freezers gasta com o uso: chame o técnico pelo painel do freezer para uma revisão, ou para o conserto se ele quebrar, antes que os gelados estraguem. Os clientes sujam a loja, e loja suja afasta gente. Limpe clicando na sujeira, contrate alguém para a faxina e compre um tapete de entrada (com o texto que quiser) na Decoração.
Produtos gelados só vão no freezer, e o clima do dia muda a procura por eles. No fim do dia sai uma notícia que altera custos e preços de mercado. De vez em quando aparece um ladrão: clique no balão em até 3 segundos para impedir o roubo. A câmera de segurança, vendida na Decoração, impede 70% dos roubos sozinha. Na tela Loja do computador dá para ligar a pausa de almoço: às 12h a loja fecha para ajustes e pedidos com entrega expressa (taxa de 30%), e volta às 13h. Ao ampliar a loja, dá para instalar uma cafeteria e contratar um atendente para servir café, croissant, pão de queijo e torta.
No **rádio** ficam o lofi, o volume e sua música (vídeo ou playlist do YouTube, ou playlist do Spotify). Em **Menu** ficam personagem, pet, dados dos clientes, histórico de notificações e controles.
O progresso é salvo automaticamente no navegador.

## Assets e créditos
Todos os assets abaixo são CC0 (domínio público) e já estão em `public/assets/kenney/`.

| Pasta | Pacote | Autor | Link |
|---|---|---|---|
| `shop/` | Mini Shop | Kenney | https://kenney.nl/assets/mini-shop |
| `characters/` | Mini Characters | Kenney | https://kenney.nl/assets/mini-characters-1 |
| `arcade/` | Mini Arcade | Kenney | https://kenney.nl/assets/mini-arcade |
| `food/` | Food Kit | Kenney | https://kenney.nl/assets/food-kit |
| `cars/` | Car Kit | Kenney | https://kenney.nl/assets/car-kit |
| `pets/` | Cube Pets | Kenney | https://kenney.nl/assets/cube-pets |
| `nature/` | Stylized Nature MegaKit (versão Standard/grátis) | Quaternius | https://quaternius.com |

Os modelos usados e seus nomes ficam em `src/game/assets.js` e no campo `model` de `src/game/config.js`.
Se um arquivo faltar, o jogo usa um modelo procedural no lugar.
