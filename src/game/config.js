export const DAY_SECONDS = 900 // um dia aberto = 15 min reais
export const OPEN_H = 9
export const CLOSE_H = 21
export const SHELF_CAP = 24
export const PACK = 12
export const SHELF_PRICE = 80
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
]
export const PID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))

// stock = sala do estoque no canto do fundo (lugares internos e limite de caixas guardadas)
export const LEVELS = [
  { name: 'Barraquinha', cols: 9,  rows: 7,  maxCust: 5,  cost: 0,    customers: 45,  maxShelves: 8,  stock: { cols: 3, rows: 2, cap: 15 } },
  { name: 'Lojinha',     cols: 11, rows: 9,  maxCust: 8,  cost: 700,  customers: 80,  maxShelves: 14, stock: { cols: 3, rows: 3, cap: 24 } },
  { name: 'Mercadinho',  cols: 13, rows: 11, maxCust: 12, cost: 2200, customers: 130, maxShelves: 23, stock: { cols: 4, rows: 3, cap: 33 } },
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
}

export const PETS = {
  cat: { name: 'Gato' },
  dog: { name: 'Cachorro' },
}

// móveis decorativos que podem ser mudados de lugar no modo layout
export const DECOR = {
  freezer: { name: 'freezer' },
  gacha:   { name: 'máquina de brindes' },
  plant:   { name: 'planta' },
  cart:    { name: 'carrinho' },
  truck:   { name: 'carrinho de carga' },
  computer: { name: 'computador' },
  radio:   { name: 'rádio' },
}

export const STAFF = {
  cashier: { name: 'Caixa',     hire: 120, wage: 35, max: 1, desc: 'Atende a fila no balcão sozinho.' },
  stocker: { name: 'Repositor', hire: 100, wage: 30, max: 3, desc: 'Recebe, desembala e repõe prateleiras já definidas.' },
}
