export const DAY_SECONDS = 900 // um dia aberto = 15 min reais
export const OPEN_H = 9
export const CLOSE_H = 21
export const SHELF_CAP = 24
export const PACK = 12
export const SHELF_PRICE = 80
export const FREEZER_PRICE = 180
export const CAMERA_STOP_CHANCE = 0.7
export const START_MONEY = 500

// shape/color = visual procedural; model = nome do .glb no Food Kit da Kenney
export const PRODUCTS = [
  { id: 'apple',  name: 'Maçã',   cost: 1.0, ref: 2.2, demand: 1.0, unlock: 0,    shape: 'sphere', color: 0xe0524d, model: 'apple' },
  { id: 'bread',  name: 'Pão',    cost: 1.5, ref: 3.2, demand: 1.0, unlock: 0,    shape: 'loaf',   color: 0xd9a066, model: 'bread' },
  { id: 'milk',   name: 'Leite',  cost: 2.0, ref: 4.0, demand: 0.9, unlock: 0,    shape: 'box',    color: 0xe8eef8, model: 'carton' },
  { id: 'cookie', name: 'Cookie', cost: 1.2, ref: 2.8, demand: 0.8, unlock: 0,    shape: 'flat',   color: 0xc98a4b, model: 'cookie' },
  { id: 'banana', name: 'Banana', cost: 1.0, ref: 2.4, demand: 0.8, unlock: 250,  shape: 'long',   color: 0xf3d54a, model: 'banana' },
  { id: 'egg',    name: 'Ovos',   cost: 2.5, ref: 5.0, demand: 0.7, unlock: 300,  shape: 'sphere', color: 0xf5ecd6, model: 'egg' },
  { id: 'cheese', name: 'Queijo', cost: 3.0, ref: 6.5, demand: 0.6, unlock: 400,  shape: 'wedge',  color: 0xf2c94c, model: 'cheese' },
  { id: 'donut',  name: 'Donut',  cost: 1.6, ref: 3.8, demand: 0.7, unlock: 500,  shape: 'torus',  color: 0xf08bb4, model: 'donut' },
  { id: 'fish',   name: 'Peixe',  cost: 5.0, ref: 11,  demand: 0.4, unlock: 900,  shape: 'long',   color: 0x7fa6c9, model: 'fish' },
  { id: 'cake',   name: 'Bolo',   cost: 6.0, ref: 13,  demand: 0.4, unlock: 1200, shape: 'cake',   color: 0xf6b8c8, model: 'cake' },
  // gelados: só ficam no freezer
  { id: 'soda',     name: 'Refrigerante', cost: 1.4, ref: 3.4, demand: 0.9, unlock: 120, shape: 'box',  color: 0xd9453d, model: 'soda-can',  cold: true },
  { id: 'popsicle', name: 'Picolé',       cost: 1.1, ref: 3.0, demand: 0.7, unlock: 200, shape: 'long', color: 0xf08bb4, model: 'popsicle',  cold: true },
  { id: 'icecream', name: 'Sorvete',      cost: 2.2, ref: 5.5, demand: 0.6, unlock: 350, shape: 'cake', color: 0xf6e7cf, model: 'ice-cream', cold: true },
]
export const PID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))

// stock = sala do estoque no canto do fundo (lugares internos e limite de caixas guardadas)
export const LEVELS = [
  { name: 'Barraquinha', cols: 9,  rows: 7,  maxCust: 5,  cost: 0,    customers: 45,  maxShelves: 8,  maxFreezers: 4, stock: { cols: 3, rows: 2, cap: 15 } },
  { name: 'Lojinha',     cols: 11, rows: 9,  maxCust: 8,  cost: 700,  customers: 80,  maxShelves: 14, maxFreezers: 6, stock: { cols: 3, rows: 3, cap: 24 } },
  { name: 'Mercadinho',  cols: 13, rows: 11, maxCust: 12, cost: 2200, customers: 130, maxShelves: 23, maxFreezers: 8, stock: { cols: 4, rows: 3, cap: 33 } },
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
  { text: 'Trigo em alta: pão, cookie e donut sobem', mods: { bread: up(1.25), cookie: up(1.25), donut: up(1.25) } },
  { text: 'Praga nos bananais: banana bem mais cara', mods: { banana: up(1.6) } },
  { text: 'Granjas lotadas: ovos baratos', mods: { egg: up(0.65) } },
  { text: 'Falta leite nos laticínios', mods: { milk: up(1.4) } },
  { text: 'Feira do peixe: barato e muito procurado', mods: { fish: { ...up(0.7), demand: 1.6 } } },
  { text: 'Influencer elogiou os donuts da cidade', mods: { donut: { ref: 1.2, demand: 1.9 } } },
  { text: 'Semana da confeitaria: bolo e cookie em alta', mods: { cake: { ref: 1.2, demand: 1.8 }, cookie: { ref: 1.15, demand: 1.5 } } },
  { text: 'Fábrica de gelo quebrou: gelados mais caros', mods: { soda: up(1.3), popsicle: up(1.3), icecream: up(1.3) } },
  { text: 'Promoção na distribuidora de bebidas', mods: { soda: up(0.7) } },
]

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
}

export const PETS = {
  cat: { name: 'Gato' },
  dog: { name: 'Cachorro' },
}

// móveis decorativos que podem ser mudados de lugar no modo layout
export const DECOR = {
  // price = à venda na loja de decoração (revenda pela metade); sem price não pode ser comprado nem vendido
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
  computer:  { name: 'computador' },
  radio:     { name: 'rádio' },
}

export const STAFF = {
  cashier: { name: 'Caixa',     hire: 120, wage: 35, max: 1, desc: 'Atende a fila no balcão sozinho.' },
  stocker: { name: 'Repositor', hire: 100, wage: 30, max: 3, desc: 'Recebe, desembala e repõe prateleiras já definidas.' },
}
