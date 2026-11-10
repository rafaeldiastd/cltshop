export const DAY_SECONDS = 900 // um dia aberto = 15 min reais
export const OPEN_H = 9
export const CLOSE_H = 21
export const SHELF_CAP = 24
export const SHELF_CAP_BIG = 36 // com a melhoria de carreira "Prateleiras Otimizadas"
export const PACK = 12
export const SHELF_PRICE = 80
export const FREEZER_PRICE = 180
export const RESALE = 0.5 // venda de prateleiras, freezers e expositores: metade do preço de compra
export const WALL_SHELF_PRICE = 100 // prateleira alta de parede
export const PRODUCE_PRICE = 200
export const MEAT_PRICE = 220
export const CAMERA_STOP_CHANCE = 0.7
// almoço opcional: o expediente para às 12h (225 s) e volta às 13h (300 s); pedidos nessa hora pagam entrega expressa
export const LUNCH = { start: 225, end: 300 }
export const EXPRESS_FEE = 0.3
export const START_MONEY = 500

// shape/color = visual procedural; model = nome do .glb no Food Kit da Kenney
export const PRODUCTS = [
  // Hortifruti (exclusivo para os expositores de hortifruti)
  { id: 'apple',      name: 'Maçã',       cost: 1.0, ref: 2.2,  demand: 1.0, start: true, shape: 'sphere', color: 0xe0524d, model: 'apple',         section: 'produce' },
  { id: 'banana',     name: 'Banana',     cost: 1.0, ref: 2.4,  demand: 0.8, shape: 'long',   color: 0xf3d54a, model: 'banana',        section: 'produce' },
  { id: 'tomato',     name: 'Tomate',     cost: 1.2, ref: 2.8,  demand: 0.85, shape: 'sphere', color: 0xd93829, model: 'tomato',        section: 'produce' },
  { id: 'carrot',     name: 'Cenoura',    cost: 0.9, ref: 2.2,  demand: 0.8, shape: 'long',   color: 0xeb7828, model: 'carrot',        section: 'produce' },
  { id: 'watermelon', name: 'Melancia',   cost: 3.5, ref: 8.5,  demand: 0.55, shape: 'sphere', color: 0x488a44, model: 'watermelon',    section: 'produce' },
  { id: 'potato',     name: 'Batata',     cost: 1.1, ref: 2.5,  demand: 0.9, shape: 'loaf',   color: 0xc49a6c, model: 'potato',        section: 'produce' },
  { id: 'onion',      name: 'Cebola',     cost: 1.1, ref: 2.6,  demand: 0.85, shape: 'sphere', color: 0xd4a373, model: 'onion',         section: 'produce' },
  { id: 'lettuce',    name: 'Alface',     cost: 1.2, ref: 2.8,  demand: 0.8, shape: 'sphere', color: 0x5fa052, model: 'cabbage',       section: 'produce' },

  // Padaria
  { id: 'bread',      name: 'Pão',        cost: 1.5, ref: 3.2,  demand: 1.0, start: true, shape: 'loaf',   color: 0xd9a066, model: 'bread',         section: 'bakery' },
  { id: 'cookie',     name: 'Cookie',     cost: 1.2, ref: 2.8,  demand: 0.8, start: true, shape: 'flat',   color: 0xc98a4b, model: 'cookie',        section: 'bakery' },
  { id: 'croissant',  name: 'Croissant',  cost: 1.9, ref: 4.5,  demand: 0.7, shape: 'torus',  color: 0xd89f52, model: 'croissant',     section: 'bakery' },
  { id: 'baguette',   name: 'Baguete',    cost: 1.6, ref: 3.9,  demand: 0.75, shape: 'loaf',   color: 0xcfa064, model: 'loaf-baguette', section: 'bakery' },
  { id: 'muffin',     name: 'Muffin',     cost: 1.7, ref: 4.1,  demand: 0.65, shape: 'cake',   color: 0x9e6344, model: 'muffin',        section: 'bakery' },
  { id: 'donut',      name: 'Donut',      cost: 1.6, ref: 3.8,  demand: 0.7, shape: 'torus',  color: 0xf08bb4, model: 'donut',         section: 'bakery' },
  { id: 'cake',       name: 'Bolo',       cost: 6.0, ref: 13,   demand: 0.4, shape: 'cake',   color: 0xf6b8c8, model: 'cake',          section: 'bakery' },

  // Mercearia
  { id: 'sugar',         name: 'Açúcar',         cost: 1.2, ref: 3.0, demand: 0.6, shape: 'box',  color: 0xf5f1e6, model: 'bag-flat',  section: 'grocery' },
  { id: 'flour',         name: 'Farinha',        cost: 1.4, ref: 3.4, demand: 0.6, shape: 'box',  color: 0xeadfc8, model: 'bag',       section: 'grocery' },
  { id: 'coffee',        name: 'Café',           cost: 3.2, ref: 7.5, demand: 0.6, shape: 'box',  color: 0x6b4a32, model: 'can-small', section: 'grocery' },
  { id: 'oil',           name: 'Óleo',           cost: 2.8, ref: 6.2, demand: 0.7, shape: 'box',  color: 0xdfb435, model: 'bottle-oil',section: 'grocery' },
  { id: 'canned_tomato', name: 'Molho de Tomate',cost: 1.4, ref: 3.5, demand: 0.8, shape: 'box',  color: 0xc23b2b, model: 'can',       section: 'grocery' },
  { id: 'chocolate',     name: 'Chocolate',      cost: 2.2, ref: 5.2, demand: 0.75, shape: 'flat',color: 0x5c3826, model: 'chocolate', section: 'grocery' },
  { id: 'egg',           name: 'Ovos',           cost: 2.5, ref: 5.0, demand: 0.7, shape: 'sphere',color: 0xf5ecd6, model: 'egg',      section: 'grocery' },
  { id: 'cheese',        name: 'Queijo',         cost: 3.0, ref: 6.5, demand: 0.6, shape: 'wedge', color: 0xf2c94c, model: 'cheese',   section: 'grocery', either: true },

  // Carnes (refrigeradas: balcão de carnes ou freezer)
  { id: 'chicken', name: 'Frango',     cost: 4.2, ref: 9.8,  demand: 0.65, shape: 'box',  color: 0xdfa07a, model: 'turkey',       cold: true, steady: true, section: 'meat' },
  { id: 'sausage', name: 'Linguiça',   cost: 3.6, ref: 8.4,  demand: 0.6,  shape: 'long', color: 0xa83d33, model: 'meat-sausage', cold: true, steady: true, section: 'meat' },
  { id: 'meat',    name: 'Carne',      cost: 6.0, ref: 13.5, demand: 0.5,  shape: 'box',  color: 0xc9544d, model: 'meat-raw',     cold: true, steady: true, section: 'meat' },
  { id: 'ribs',    name: 'Costelinha', cost: 6.5, ref: 14.8, demand: 0.5,  shape: 'box',  color: 0x8c2b2b, model: 'meat-ribs',    cold: true, steady: true, section: 'meat' },
  { id: 'fish',    name: 'Peixe',      cost: 5.0, ref: 11.0, demand: 0.4,  shape: 'long', color: 0x7fa6c9, model: 'fish',         cold: true, steady: true, section: 'meat' },

  // Bebidas (algumas geladas no freezer, outras ambiente)
  { id: 'milk',     name: 'Leite',        cost: 2.0, ref: 4.0,  demand: 0.9, start: true, shape: 'box',  color: 0xe8eef8, model: 'carton',      section: 'drink', either: true },
  { id: 'water',    name: 'Água',         cost: 0.6, ref: 2.0,  demand: 0.9, shape: 'box',  color: 0x9fd0e0, model: 'soda-bottle', cold: true, section: 'drink' },
  { id: 'soda',     name: 'Refrigerante', cost: 1.4, ref: 3.4,  demand: 0.9, shape: 'box',  color: 0xd9453d, model: 'soda-can',    cold: true, section: 'drink' },
  { id: 'juice',    name: 'Suco',         cost: 1.3, ref: 3.6,  demand: 0.7, shape: 'box',  color: 0xf2a23b, model: 'carton-small',cold: true, section: 'drink' },
  { id: 'tea',      name: 'Chá Gelado',   cost: 1.8, ref: 4.4,  demand: 0.7, shape: 'box',  color: 0xc28535, model: 'soda-bottle', cold: true, section: 'drink' },
  { id: 'energy',   name: 'Energético',   cost: 2.8, ref: 6.8,  demand: 0.75, shape: 'box',  color: 0x1f7a8c, model: 'soda-can',    cold: true, section: 'drink' },
  { id: 'wine',     name: 'Vinho',        cost: 8.5, ref: 19.0, demand: 0.45, shape: 'box',  color: 0x581124, model: 'wine-red',    section: 'drink' },
  { id: 'popsicle', name: 'Picolé',       cost: 1.1, ref: 3.0,  demand: 0.7, shape: 'long', color: 0xf08bb4, model: 'popsicle',    cold: true, section: 'drink' },
  { id: 'icecream', name: 'Sorvete',      cost: 2.2, ref: 5.5,  demand: 0.6, shape: 'cake', color: 0xf6e7cf, model: 'ice-cream',   cold: true, section: 'drink' },
]
export const PID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))

// stock = sala do estoque no canto do fundo (lugares internos e limite de caixas guardadas)
export const LEVELS = [
  // cols/rows: tamanho de referência (saves antigos e clientes por área); maxCols/maxRows: até onde o tipo deixa construir; cost: preço para virar esse tipo
  { name: 'Barraquinha', cols: 9,  rows: 7,  maxCols: 11, maxRows: 9,  maxCust: 5,  cost: 0,   customers: 45,  maxShelves: 14, maxFreezers: 8, maxMeat: 4, maxProduce: 4, stock: { cols: 3, rows: 2, maxCols: 3, maxRows: 3 } },
  { name: 'Lojinha',     cols: 11, rows: 9,  maxCols: 13, maxRows: 11, maxCust: 8,  cost: 200, customers: 80,  maxShelves: 14, maxFreezers: 8, maxMeat: 6, maxProduce: 6, stock: { cols: 3, rows: 3, maxCols: 4, maxRows: 3 } },
  { name: 'Mercadinho',  cols: 13, rows: 11, maxCols: 15, maxRows: 13, maxCust: 12, cost: 500, customers: 130, maxShelves: 23, maxFreezers: 8, maxMeat: 8, maxProduce: 8, stock: { cols: 4, rows: 3, maxCols: 6, maxRows: 5 } },
]

// clima do dia: multiplica a procura pelos produtos gelados
export const WEATHER = {
  hot:  { name: 'Calor', cold: 2.2 },
  mild: { name: 'Ameno', cold: 1 },
  cold: { name: 'Frio',  cold: 0.4 },
}

// sorteados no fim do dia; valem para o dia seguinte (cost = custo, ref = preço de mercado, demand = procura)
const up = (k) => ({ cost: k, ref: 1 + (k - 1) * 0.85 })
export const EVENTS = [
  { text: 'Barcos encalhados no porto: queijo e peixe mais caros', mods: { cheese: up(1.4), fish: up(1.5) } },
  { text: 'Safra recorde de maçãs: preço despenca', mods: { apple: up(0.65) } },
  { text: 'Greve dos padeiros: pão bem mais caro', mods: { bread: up(1.45) } },
  { text: 'Trigo em alta: pão, farinha, cookie e donut sobem', mods: { bread: up(1.25), flour: up(1.3), cookie: up(1.25), donut: up(1.25) } },
  { text: 'Praga nos bananais: banana bem mais cara', mods: { banana: up(1.6) } },
  { text: 'Granjas lotadas: ovos baratos', mods: { egg: up(0.65) } },
  { text: 'Baixa produção de leite', mods: { milk: up(1.4) } },
  { text: 'Feira do peixe: barato e muito procurado', mods: { fish: { ...up(0.7), demand: 1.6 } } },
  { text: 'Influencer elogiou os donuts da cidade', mods: { donut: { ref: 1.2, demand: 1.9 } } },
  { text: 'Semana da confeitaria: bolo, donut e cookie em alta', mods: { cake: { ref: 1.2, demand: 1.8 }, cookie: { ref: 1.15, demand: 1.5 }, donut: { ref: 1.15, demand: 1.5 } } },
  { text: 'Fábrica de gelo quebrou: gelados mais caros', mods: { soda: up(1.3), popsicle: up(1.3), icecream: up(1.3) } },
  { text: 'Promoção na distribuidora de bebidas', mods: { soda: up(0.7), juice: up(0.75) } },
  { text: 'Geada nos cafezais: café bem mais caro', mods: { coffee: up(1.5) } },
  { text: 'Usinas lotadas: açúcar barato', mods: { sugar: up(0.65) } },
  { text: 'Greve nos frigoríficos: carne mais cara', mods: { meat: up(1.4) } },
]

// ---------- boatos do mercado: aparecem de vez em quando e se cumprem na maioria das vezes ----------
// every = intervalo (em dias) entre um boato e o próximo; lead = em quantos dias o evento acontece; chance = probabilidade de se cumprir
// surprise = chance de uma notícia sem aviso em dia sem boato
export const RUMOR = { every: [3, 4], lead: 2, chance: 0.6, surprise: 0.3, firstDay: 2 }

// cafeteria: expansão liberada pelo tipo de comércio; os pedidos são feitos na hora, sem estoque
export const CAFE = { price: 900, minLevel: 1, chance: 0.4 }
export const CAFE_MENU = [
  // uses: ingredientes; o custo e o preço de mercado acompanham as notícias sobre eles
  // a receita entra no livro (e no cardápio) quando todos os ingredientes já foram comprados no atacado
  { id: 'espresso',    name: 'Café',          ref: 5, cost: 1.2, weight: 1.2, uses: ['coffee', 'milk', 'sugar'], model: 'cup-coffee', desc: 'Cafezinho passado na hora.' },
  { id: 'croissant',   name: 'Croissant',     ref: 7, cost: 2.2, weight: 0.9, uses: ['flour', 'milk'], model: 'croissant', desc: 'Folhado e amanteigado.' },
  { id: 'cheesebread', name: 'Pão de queijo', ref: 4, cost: 1.1, weight: 1,   uses: ['cheese', 'flour', 'egg'], model: 'loaf-round', desc: 'Quentinho, direto do forno mineiro.' },
  { id: 'pie',         name: 'Torta',         ref: 9, cost: 3,   weight: 0.6, uses: ['flour', 'sugar', 'egg', 'apple'], model: 'pie', desc: 'Torta de maçã da vovó.' },
  { id: 'pingado',     name: 'Pingado com pão na chapa', ref: 8, cost: 2.0, weight: 1.1, uses: ['coffee', 'milk', 'bread'], model: 'sandwich', desc: 'O clássico da padaria: café com leite e pão na manteiga tostado.' },
  { id: 'suco',        name: 'Suco natural',  ref: 6, cost: 1.4, weight: 0.9, uses: ['apple', 'banana', 'sugar'], model: 'soda-glass', desc: 'Frutas batidas na hora com um pouco de açúcar.' },
  { id: 'coxinha',     name: 'Coxinha',       ref: 6, cost: 1.8, weight: 1.1, uses: ['flour', 'meat', 'milk'], model: 'dim-sum', desc: 'Massa cremosa, recheio caprichado e casquinha crocante.' },
  { id: 'empadinha',   name: 'Empadinha',     ref: 5.5, cost: 1.6, weight: 0.8, uses: ['flour', 'egg', 'cheese', 'meat'], model: 'mincemeat-pie', desc: 'Massinha que derrete na boca.' },
]
export const CAFE_ID = Object.fromEntries(CAFE_MENU.map((m) => [m.id, m]))
// construção: 1 quadrado = 1 m²; o preço sobe conforme a área total, e o m² de estoque custa o dobro
export const BUILD = { base: 20, perM2: 0.375, from: 63, stockFactor: 2 }

// o que o cliente sente: aparece no balão sobre a cabeça e na aba Clientes
export const MOODS = {
  love:      { emoji: '😍', text: 'Adorou: loja cheia e tudo que queria' },
  like:      { emoji: '🙂', text: 'Gostou: viu o que queria' },
  meh:       { emoji: '😐', text: 'Viu só parte do que queria' },
  empty:     { emoji: '😟', text: 'Não viu nada do que queria' },
  bought:    { emoji: '🛒', text: 'Pegou um produto' },
  missing:   { emoji: '😕', text: 'Produto em falta' },
  pricey:    { emoji: '💸', text: 'Achou caro' },
  impatient: { emoji: '😤', text: 'Impaciente na fila' },
  angry:     { emoji: '😡', text: 'Desistiu da fila' },
  nothing:   { emoji: '😞', text: 'Saiu sem comprar' },
  paid:      { emoji: '😊', text: 'Pagou satisfeito' },
  closed:    { emoji: '🔒', text: 'Chegou e a loja já tinha fechado' },
  hot:       { emoji: '🥵', text: 'Com calor, queria algo gelado' },
  sneaky:    { emoji: '🤫', text: 'Tentou roubar' },
  caught:    { emoji: '😳', text: 'Foi pego roubando' },
  stole:     { emoji: '😈', text: 'Roubou e fugiu' },
  cafe:      { emoji: '😋', text: 'Lanchou na cafeteria' },
  lunch:     { emoji: '😒', text: 'Encontrou a loja fechada no almoço' },
  impulse:   { emoji: '🤩', text: 'Viu um produto em destaque e levou por impulso' },
  arcade:    { emoji: '🕹️', text: 'Jogou uma ficha no fliperama' },
  dirty:     { emoji: '🤢', text: 'Achou a loja suja' },
}

export const PETS = {
  cat: { name: 'Gato' },
  dog: { name: 'Cachorro' },
  bunny: { name: 'Coelho' },
  chick: { name: 'Pintinho' },
  parrot: { name: 'Papagaio' },
  penguin: { name: 'Pinguim' },
  pig: { name: 'Porco' },
  hog: { name: 'Javali' },
  cow: { name: 'Vaca' },
  deer: { name: 'Cervo' },
  fox: { name: 'Raposa' },
  beaver: { name: 'Castor' },
  koala: { name: 'Coala' },
  panda: { name: 'Panda' },
  polar: { name: 'Urso' },
  monkey: { name: 'Macaco' },
  lion: { name: 'Leão' },
  tiger: { name: 'Tigre' },
  elephant: { name: 'Elefante' },
  giraffe: { name: 'Girafa' },
  crab: { name: 'Caranguejo' },
  fish: { name: 'Peixe' },
  bee: { name: 'Abelha' },
  caterpillar: { name: 'Lagarta' },
}

// móveis decorativos que podem ser mudados de lugar no modo layout
export const DECOR = {
  // price = à venda na loja de decoração (revenda pela metade); sem price não pode ser comprado nem vendido
  // wall = fica pendurado na parede do fundo (não ocupa o chão): só muda a posição ao longo da parede
  clock:     { name: 'relógio de parede', price: 40, wall: true, desc: 'Pendurado na parede do fundo' },
  frame:     { name: 'quadro', price: 30, wall: true, desc: 'Pendurado na parede do fundo' },
  dFlowers:  { name: 'vitrine de flores', price: 60 },
  plant:     { name: 'planta', price: 30 },
  cart:      { name: 'carrinho', price: 40 },
  truck:     { name: 'carrinho de carga', price: 60 },
  dFruit:    { name: 'banca de frutas', price: 60 },
  dBread:    { name: 'vitrine de pães', price: 60 },
  column:    { name: 'coluna', price: 70 },
  bottles:   { name: 'retorno de garrafas', price: 80 },
  mannequin: { name: 'manequim', price: 90 },
  gacha:     { name: 'máquina de brindes', price: 120 },
  camera:    { name: 'câmera de segurança', price: 400, max: 1, desc: 'Impede 70% dos roubos sozinha' },
  cafeTable: { name: 'mesinha de café', price: 50 },
  ticket:    { name: 'máquina de tíquetes', price: 110 },
  prizeWheel: { name: 'roda de prêmios', price: 130 },
  vending:   { name: 'máquina de salgadinhos', price: 150 },
  arcade:    { name: 'fliperama', price: 200 },
  pinball:   { name: 'pinball', price: 220 },
  claw:      { name: 'máquina de garra', price: 240 },
  basketball: { name: 'basquete de arcade', price: 260 },
  airHockey: { name: 'aero hockey', price: 280 },
  dance:     { name: 'máquina de dança', price: 320 },
  // perk = só aparece para compra depois da melhoria de carreira correspondente
  lamp:      { name: 'abajur', price: 90, perk: 'lights', desc: 'Atrai clientes à noite (18h–21h)' },
  led:       { name: 'fita LED', price: 70, perk: 'lights', desc: 'Atrai clientes à noite (18h–21h)' },
  computer:  { name: 'computador' },
  radio:     { name: 'rádio' },
}

// hire = taxa de contratação; wage = salário de referência (cada candidato pede o seu); nameF = cargo no feminino
export const STAFF = {
  cashier: { name: 'Caixa',     hire: 120, wage: 35, max: 1, desc: 'Atende a fila no balcão sozinho.' },
  stocker: { name: 'Repositor', nameF: 'Repositora', hire: 100, wage: 30, max: 3, desc: 'Recebe, desembala e repõe prateleiras já definidas. Também separa os pedidos de delivery.' },
  barista: { name: 'Atendente do café', hire: 150, wage: 40, max: 1, desc: 'Prepara e serve os pedidos da cafeteria.' },
  courier: { name: 'Motoboy', nameF: 'Motogirl', hire: 140, wage: 35, max: 1, desc: 'Entrega os pedidos do Zap da Lojinha de moto, sem ocupar fila nem espaço na loja.' },
  cleaner: { name: 'Faxineiro', nameF: 'Faxineira', hire: 90, wage: 28, max: 1, desc: 'Limpa a sujeira que os clientes deixam pela loja.' },
}

// ---------- plano de carreira: pontos de maestria ganhos atendendo clientes, gastos em melhorias permanentes ----------
export const CAREER = [
  { id: 'basket1', name: 'Cestinhas Maiores', cost: 1, desc: 'Clientes passam a levar até 4 produtos diferentes por compra.' },
  { id: 'basket2', name: 'Carrinhos de Compra', cost: 2, req: 'basket1', desc: 'Clientes passam a levar até 5 produtos diferentes por compra.' },
  { id: 'shelf', name: 'Prateleiras Otimizadas', cost: 2, desc: `Cada prateleira e freezer guarda ${SHELF_CAP_BIG} unidades em vez de ${SHELF_CAP}.` },
  { id: 'plants', name: 'Feng Shui', cost: 1, desc: 'Plantas a até 2 quadrados do caixa deixam a fila 30% mais paciente.' },
  { id: 'arcade', name: 'Fliperama Rentável', cost: 2, desc: 'Fliperama, pinball e máquina de dança rendem moedas a cada cliente que passa por perto.' },
  { id: 'lights', name: 'Iluminação Personalizada', cost: 2, desc: 'Libera abajur e fita LED na decoração. Cada um atrai +25% de clientes das 18h às 21h (até +50%).' },
]
export const CAREER_ID = Object.fromEntries(CAREER.map((c) => [c.id, c]))
// experiência para o próximo ponto: cresce a cada ponto já ganho
export const careerNext = (earned) => 25 + earned * 15
export const FENG_SHUI = { radius: 2.2, patience: 1.3 }
export const ARCADE = { types: ['arcade', 'pinball', 'dance'], radius: 1.8, min: 0.5, max: 1.5 }
export const NIGHT_LIGHTS = { types: ['lamp', 'led'], from: 18, each: 0.25, max: 0.5 }

// ---------- destaque das prateleiras: chama atenção para o produto ----------
// willing = cliente aceita pagar um pouco mais; impulse = chance de quem passa perto levar sem ter planejado
export const SHELF_BOOST = [
  { name: 'Simples', price: 0, willing: 1, impulse: 0 },
  { name: 'Faixa chamativa', price: 60, willing: 1.08, impulse: 0.12, desc: 'Faixa colorida e etiqueta de oferta.' },
  { name: 'Expositor premium', price: 150, willing: 1.15, impulse: 0.25, desc: 'Luz de destaque e placa brilhante.' },
]

// ---------- delivery pelo Zap da Lojinha ----------
export const DELIVERY = { fee: 4, rate: 0.08, maxOpen: 2, pick: 3, ride: [35, 55] }

// ---------- contratos com fornecedores: comprar muito do mesmo produto libera caixas maiores com desconto ----------
// at = unidades já compradas daquele produto
export const CONTRACTS = [
  { name: 'Parceiro', at: 120, sizes: { 24: 0.1 } },
  { name: 'Exclusivo', at: 360, sizes: { 24: 0.15, 48: 0.2 } },
]

// ---------- pet ----------
export const PET = { pat: 25, treat: 60, treatCost: 3, staffBoost: 1.25, findChance: 0.15, findsPerDay: 3 }

// ---------- passe da lojinha: cada nível de experiência libera uma recompensa para resgatar ----------
// a posição na lista é o nível (o primeiro é o nível 1); product = novo fornecedor, money = bônus no caixa
export const PASS = [
  { product: 'water', money: 100 },
  { product: 'sugar', money: 100 },
  { product: 'tomato', money: 140 },
  { product: 'soda', money: 140 },
  { product: 'flour', money: 120 },
  { product: 'croissant', money: 150 },
  { product: 'coffee', money: 150 },
  { product: 'carrot', money: 160 },
  { product: 'potato', money: 160 },
  { product: 'juice', money: 160 },
  { product: 'canned_tomato', money: 180 },
  { product: 'onion', money: 170 },
  { product: 'popsicle', money: 170 },
  { product: 'banana', money: 170 },
  { product: 'lettuce', money: 180 },
  { product: 'baguette', money: 180 },
  { product: 'chicken', money: 190 },
  { product: 'egg', money: 200 },
  { product: 'oil', money: 200 },
  { product: 'tea', money: 210 },
  { product: 'cheese', money: 220 },
  { product: 'sausage', money: 230 },
  { product: 'muffin', money: 230 },
  { product: 'icecream', money: 240 },
  { product: 'chocolate', money: 250 },
  { product: 'meat', money: 260 },
  { product: 'watermelon', money: 270 },
  { product: 'donut', money: 270 },
  { product: 'energy', money: 280 },
  { product: 'ribs', money: 300 },
  { product: 'fish', money: 300 },
  { product: 'wine', money: 320 },
  { product: 'cake', money: 350 },
]

// ---------- metas do dia: três objetivos pequenos; a recompensa é uma fração do próximo nível ----------
export const GOALS = { perDay: 3, xp: { easy: 0.15, mid: 0.22, hard: 0.3 }, minXp: 6 }

// ---------- equipe: cada funcionário é uma pessoa com competência, velocidade e salário pedido ----------
export const TEAM = {
  candidates: 6, // vagas no catálogo de candidatos
  newPerDay: 2, // candidatos que trocam a cada manhã
  adCost: 25, // anúncio de vaga: renova o catálogo inteiro
  severance: 2, // rescisão = salários de um dia × isto
  drainBusy: 0.09, drainIdle: 0.03, // energia gasta por segundo de loja aberta
  lunchRest: 40, petRest: 0.06, tired: 30,
  requestChance: 0.14, maxRequests: 2, requestDays: 2,
  quitMorale: 20,
}
export const levelXp = (level) => 20 + level * 12 // trabalho para o funcionário subir de nível
export const NAMES = {
  f: ['Ana', 'Bia', 'Carla', 'Dani', 'Elaine', 'Fernanda', 'Gabi', 'Helena', 'Isabela', 'Joana', 'Karina', 'Lívia', 'Marta', 'Nathália', 'Patrícia', 'Rosa', 'Sueli', 'Tati', 'Vanessa', 'Yasmin'],
  m: ['André', 'Bruno', 'Caio', 'Diego', 'Edu', 'Fábio', 'Gustavo', 'Heitor', 'Igor', 'João', 'Kauã', 'Lucas', 'Marcos', 'Nando', 'Otávio', 'Paulo', 'Rafa', 'Sérgio', 'Thiago', 'Vítor'],
}
// pedidos dos funcionários: morale = quanto a satisfação muda ao aceitar ou recusar
export const REQUESTS = {
  raise:  { name: 'Aumento', yes: 20, no: -20 },
  dayoff: { name: 'Folga', yes: 15, no: -12 },
  course: { name: 'Curso', cost: 80, yes: 10, no: -8 },
  gear:   { name: 'Equipamento', cost: 60, yes: 10, no: -8 },
}

// ---------- freezer: o motor gasta com o uso, e o técnico faz revisão ou conserto ----------
// wear vai de 0 a 100; a revisão só vale a partir de serviceMin; acima de risk ele pode quebrar, e em 100 quebra com certeza
export const FREEZER = { wearPerSec: 16 / 900, wearPerUnit: 0.08, hot: 1.5, serviceMin: 30, warn: 60, risk: 80, breakRate: 0.006, spoilAfter: 40, spoilEvery: 5, overnight: 0.5 }
export const TECH = { serviceBase: 20, servicePerWear: 0.4, repair: 110, serviceTime: 18, repairTime: 36, arrive: [8, 14] }

// ---------- sujeira: clientes sujam a loja; sujeira afasta clientes e piora a primeira impressão ----------
// chances por cliente: enter = pegadas na entrada, spill = algo derramado na prateleira, crumbs = farelo na cafeteria
export const DIRT = { enter: 0.2, spill: 0.05, crumbs: 0.25, max: 40, full: 18, spawn: 0.35, feel: 0.25, rep: 0.01, clean: 1.2 }
export const DOORMAT = { price: 80, dirt: 0.35, maxText: 20, colors: ['#ef8a77', '#6fb3a8', '#f2c25b', '#5b4a6e', '#7fa6c9', '#8a6a4a'] }

// Regra de compatibilidade entre móvel expositor e produto
export function canStockProduct(productId, shelf) {
  const p = PID[productId]
  if (!p || !shelf) return false
  const kind = shelf.kind || (shelf.fridge ? 'fridge' : 'shelf')
  // Expositor de hortifruti: SÓ aceita produtos de hortifruti
  if (kind === 'produce') return p.section === 'produce'
  // Freezer de carnes: SÓ aceita carnes (costelinha, carne, peixe, frango, linguiça)
  if (kind === 'meat') return p.section === 'meat'
  // Freezer comum de gelados: aceita produtos gelados (bebidas/sorvetes), mas NÃO carnes
  if (kind === 'fridge') return !!p.cold && p.section !== 'meat'
  // Prateleira seca: produtos ambiente, NÃO hortifruti, NÃO carnes, NÃO gelados
  return !p.cold && p.section !== 'produce' && p.section !== 'meat'
}

