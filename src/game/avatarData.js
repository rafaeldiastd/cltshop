// Dados do criador de personagem (sem Three.js: o estado e a rede também usam).
// O personagem é um objeto pequeno, que cabe no save e pode viajar pela rede:
// { head, body, skin, hair, eyes, top, bottom, hat, hatColor, face }
// head/body: modelo do Mini Characters de onde sai cada parte (todos têm o mesmo esqueleto)
// skin/hair/eyes/top/bottom: célula da paleta colormap.png ("linha.coluna"), ou null para a cor original

// mesma ordem da lista de personagens do assets.js (o índice antigo de settings.character aponta para cá)
export const AVATAR_PARTS = [
  'employee',
  ...'abcdef'.split('').map((l) => `female-${l}`),
  ...'abcdefg'.split('').map((l) => `male-${l}`),
  'worker', 'alien', 'knight', 'raider', 'robot', 'soldier', 'zombie',
]
export const partUrl = (id) => (id === 'employee' ? 'shop/character-employee.glb' : `characters/character-${id}.glb`)

export const defaultAvatar = (id = 'employee') => ({
  head: id, body: id, skin: null, hair: null, eyes: null, top: null, bottom: null,
  hat: 'none', hatColor: '#ef8a77', face: 'none',
})

// cores da paleta (células pares; a ímpar do lado é a versão em degradê da mesma cor)
export const SKIN_TONES = [
  { cell: '2.6', hex: '#fde4c7' }, { cell: '2.4', hex: '#f2bf99' }, { cell: '2.0', hex: '#f1976c' },
  { cell: '2.2', hex: '#b06041' }, { cell: '2.8', hex: '#61cb8b' }, { cell: '1.4', hex: '#a878e8' },
]
export const PALETTE = [
  { cell: '3.6', hex: '#38383d' }, { cell: '3.10', hex: '#4f5260' }, { cell: '3.8', hex: '#868ba1' }, { cell: '3.14', hex: '#ffffff' },
  { cell: '2.2', hex: '#b06041' }, { cell: '3.0', hex: '#e6b96e' }, { cell: '2.10', hex: '#ffc044' }, { cell: '2.12', hex: '#ff7e44' },
  { cell: '2.14', hex: '#cf534f' }, { cell: '1.6', hex: '#f378f0' }, { cell: '1.8', hex: '#f5c8f0' }, { cell: '1.4', hex: '#a878e8' },
  { cell: '3.2', hex: '#67648d' }, { cell: '1.0', hex: '#6794d9' }, { cell: '1.2', hex: '#d0e8ff' }, { cell: '2.8', hex: '#61cb8b' },
]

export const HATS = [
  { id: 'none', name: 'Nenhum' },
  { id: 'cap', name: 'Boné' },
  { id: 'beanie', name: 'Gorro' },
  { id: 'straw', name: 'Chapéu' },
  { id: 'chef', name: 'Chef' },
  { id: 'bow', name: 'Laço' },
  { id: 'headphones', name: 'Fone' },
  { id: 'party', name: 'Festa' },
  { id: 'crown', name: 'Coroa' },
]
export const HAT_COLORS = ['#ef8a77', '#6fb3a8', '#f2c25b', '#5b4a6e', '#f6e7cf', '#7fa6c9', '#38383d', '#f378f0']
export const FACES = [
  { id: 'none', name: 'Nada' },
  { id: 'glasses', name: 'Óculos' },
  { id: 'sunglasses', name: 'Óculos escuros' },
  { id: 'mustache', name: 'Bigode' },
]

const pick = (list) => list[Math.floor(Math.random() * list.length)]
// personagem sorteado (só gente: os especiais, como robô e alienígena, ficam para quem escolher)
export function randomAvatar() {
  const people = AVATAR_PARTS.filter((p) => /male|employee|worker/.test(p))
  return {
    head: pick(people), body: pick(people),
    skin: pick(SKIN_TONES.slice(0, 4)).cell, hair: pick(PALETTE.slice(0, 9)).cell, eyes: null,
    top: pick(PALETTE).cell, bottom: pick(PALETTE).cell,
    hat: Math.random() < 0.5 ? 'none' : pick(HATS.slice(1)).id, hatColor: pick(HAT_COLORS),
    face: Math.random() < 0.7 ? 'none' : pick(FACES.slice(1)).id,
  }
}
