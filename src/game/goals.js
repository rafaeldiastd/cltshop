// Metas do dia: três objetivos pequenos, contados com as estatísticas de game.today, que rendem experiência.
import { game, toast, money, gainXp, xpNext, customersPerDay, hasPerk } from './state.js'
import { PID, GOALS } from './config.js'
import { onDuty } from './team.js'

const sum = (o) => Object.values(o || {}).reduce((s, n) => s + n, 0)
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5)
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1))

// final = só é cumprida no fim do dia, se nada der errado até lá (bad conta os deslizes)
const KINDS = {
  serve: { diff: 'easy', make: () => ({ target: round5(customersPerDay() * 0.45) }), cur: (t) => t.served, text: (g) => `Atender ${g.target} clientes` },
  revenue: {
    diff: 'mid',
    make: () => {
      const last = game.summary?.revenue || customersPerDay() * 4
      return { target: Math.max(50, Math.round((last * 1.1) / 10) * 10) }
    },
    cur: (t) => t.revenue, text: (g) => `Vender ${money(g.target)} no dia`, money: true,
  },
  sell: {
    diff: 'easy',
    make: () => {
      const stocked = [...new Set(game.shelves.filter((s) => s.product && s.count > 0).map((s) => s.product))]
      const pool = stocked.length ? stocked : Object.keys(game.unlocked)
      const pid = pool[Math.floor(Math.random() * pool.length)]
      return pid ? { pid, target: rint(6, 9) + game.level * 3 } : null
    },
    cur: (t, g) => t.sold[g.pid] || 0, text: (g) => `Vender ${g.target} ${PID[g.pid].name}`,
  },
  love: { diff: 'mid', make: () => ({ target: Math.max(3, Math.round(customersPerDay() * 0.12)) }), cur: (t) => t.moods.love || 0, text: (g) => `${g.target} clientes adorarem a loja` },
  noMissing: { diff: 'hard', final: true, make: () => ({}), bad: (t) => sum(t.oos), text: () => 'Nenhum cliente ficar sem o produto que queria' },
  noQuit: { diff: 'mid', final: true, make: () => ({}), bad: (t) => t.patience, text: () => 'Ninguém desistir da fila' },
  clean: { diff: 'easy', make: () => ({ target: rint(3, 5) }), cur: (t) => t.cleaned, text: (g) => `Limpar ${g.target} sujeiras da loja` },
  cafe: { diff: 'mid', when: () => game.cafe && onDuty('barista') > 0, make: () => ({ target: rint(6, 10) }), cur: (t) => t.cafeSales, text: (g) => `Servir ${g.target} pedidos na cafeteria` },
  delivery: { diff: 'mid', when: () => game.zapOn && onDuty('courier') > 0, make: () => ({ target: rint(2, 3) }), cur: (t) => t.deliveries || 0, text: (g) => `Entregar ${g.target} pedidos do Zap` },
  impulse: { diff: 'mid', when: () => game.shelves.some((s) => s.boost > 0 && s.count > 0), make: () => ({ target: rint(3, 5) }), cur: (t) => t.impulse || 0, text: (g) => `${g.target} compras por impulso` },
  noTheft: { diff: 'easy', final: true, when: () => game.day >= 2, make: () => ({}), bad: (t) => t.stolenUnits, text: () => 'Não deixar nenhum ladrão escapar' },
  arcade: { diff: 'easy', when: () => hasPerk('arcade'), make: () => ({ target: rint(4, 8) }), cur: (t) => t.arcadeRevenue || 0, text: (g) => `Ganhar ${money(g.target)} nos fliperamas`, money: true },
  produce: {
    diff: 'mid',
    when: () => Object.keys(game.unlocked).some((id) => PID[id]?.section === 'produce'),
    make: () => ({ target: rint(6, 10) + game.level * 2 }),
    cur: (t) => Object.entries(t.sold || {}).reduce((s, [id, n]) => s + (PID[id]?.section === 'produce' ? n : 0), 0),
    text: (g) => `Vender ${g.target} itens de Hortifruti`,
  },
  meat: {
    diff: 'mid',
    when: () => Object.keys(game.unlocked).some((id) => PID[id]?.section === 'meat'),
    make: () => ({ target: rint(4, 8) + game.level * 2 }),
    cur: (t) => Object.entries(t.sold || {}).reduce((s, [id, n]) => s + (PID[id]?.section === 'meat' ? n : 0), 0),
    text: (g) => `Vender ${g.target} produtos de Carnes/Açougue`,
  },
  bakery: {
    diff: 'easy',
    when: () => Object.keys(game.unlocked).some((id) => PID[id]?.section === 'bakery'),
    make: () => ({ target: rint(6, 12) + game.level * 2 }),
    cur: (t) => Object.entries(t.sold || {}).reduce((s, [id, n]) => s + (PID[id]?.section === 'bakery' ? n : 0), 0),
    text: (g) => `Vender ${g.target} delícias da Padaria`,
  },
  drink: {
    diff: 'easy',
    when: () => Object.keys(game.unlocked).some((id) => PID[id]?.section === 'drink'),
    make: () => ({ target: rint(6, 12) + game.level * 2 }),
    cur: (t) => Object.entries(t.sold || {}).reduce((s, [id, n]) => s + (PID[id]?.section === 'drink' ? n : 0), 0),
    text: (g) => `Vender ${g.target} Bebidas`,
  },
}

export function makeGoals() {
  const kinds = Object.keys(KINDS).filter((k) => !KINDS[k].when || KINDS[k].when())
  const out = []
  // no máximo uma meta de "nada pode dar errado" por dia
  while (out.length < GOALS.perDay && kinds.length) {
    const k = kinds.splice(Math.floor(Math.random() * kinds.length), 1)[0]
    if (KINDS[k].final && out.some((g) => KINDS[g.kind].final)) continue
    const extra = KINDS[k].make()
    if (!extra) continue
    const g = { kind: k, ...extra, done: false, failed: false }
    g.text = KINDS[k].text(g)
    g.xp = Math.max(GOALS.minXp, Math.round(xpNext() * GOALS.xp[KINDS[k].diff]))
    out.push(g)
  }
  game.goals = out
  game.goalsDay = game.day
}

// progresso para a interface: cur/target e se é do tipo "até o fim do dia"
export function goalProgress(g) {
  const K = KINDS[g.kind], t = game.today
  if (!K) return { cur: 0, target: 1, final: false }
  if (K.final) return { cur: g.done ? 1 : 0, target: 1, final: true, bad: K.bad(t) }
  return { cur: Math.min(g.target, K.cur(t, g)), target: g.target, final: false, money: !!K.money }
}

function complete(g) {
  g.done = true
  gainXp(g.xp)
  toast(`Meta cumprida: ${g.text} (+${g.xp} XP)`, 'good')
}
// endOfDay = o expediente acabou: as metas "até o fim do dia" que resistiram são cumpridas
export function checkGoals(endOfDay = false) {
  if (game.goalsDay !== game.day) return
  const t = game.today
  for (const g of game.goals) {
    const K = KINDS[g.kind]
    if (!K || g.done || g.failed) continue
    if (K.final) {
      if (K.bad(t) > 0) g.failed = true
      else if (endOfDay) complete(g)
    } else if (K.cur(t, g) >= g.target) complete(g)
    else if (endOfDay) g.failed = true
  }
}
export const goalsDone = () => game.goals.filter((g) => g.done).length
