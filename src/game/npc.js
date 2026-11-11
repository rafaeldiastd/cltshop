// Clientes (NPCs): identidade e um resumo do que cada um veio buscar, deixou de achar e comprou.
import { PID, NAMES, MOODS, levelXp } from './config.js'
import { isOff, isTired, fairWage, roleName, requestText, workLoad } from './team.js'

// nome e idade sorteados quando o cliente chega
export function newNpcIdentity() {
  const g = Math.random() < 0.5 ? 'f' : 'm'
  const list = NAMES[g]
  // g define o nome e o modelo 3D (look = letra do modelo, 6 femininos e 7 masculinos, como em people.js)
  return { g, name: list[Math.floor(Math.random() * list.length)], age: 16 + Math.floor(Math.random() * 56), look: Math.floor(Math.random() * (g === 'f' ? 6 : 7)) }
}

const pname = (pid) => PID[pid]?.name ?? pid

// foto do cliente agora: o que veio buscar, o que deixou de achar e o que levou
export function npcInfo(c) {
  const came = c.came.map((w) => ({ name: pname(w.pid), qty: w.qty }))
  if (c.cafeCame) came.push({ name: c.cafeCame, qty: 1 })
  const bought = c.basket.map((b) => ({ name: pname(b.pid), qty: b.qty, total: b.qty * b.price }))
  if (c.cafeBuy) bought.push({ name: c.cafeBuy.name, qty: 1, total: c.cafeBuy.price })
  // o que ficou sem levar, separado pelo motivo
  const names = (kind) => [...new Set(c.issues.filter((i) => i.kind === kind).map((i) => pname(i.pid)))]
  const unseen = names('unseen'), missing = names('missing')
  const pricey = c.issues.filter((i) => i.kind === 'pricey').map((i) => ({ name: pname(i.pid), price: i.price, willing: i.willing }))
  if (c.cafeSkipped) pricey.push({ name: c.cafeSkipped.name, price: c.cafeSkipped.price, willing: null })
  const total = bought.reduce((s, b) => s + b.total, 0)

  let status = 'Escolhendo produtos'
  if (!c.entered) status = 'Chegando na loja'
  else if (c.thief) status = 'Tentando furtar'
  else if (c.state === 'queued') status = 'Na fila do caixa'
  else if (c.state === 'leaving') status = 'Saindo da loja'
  else if (c.atCafe) status = 'Na cafeteria'

  // emoções que ele já sentiu nesta visita (fila, preço, falta de produto...), na ordem em que aconteceram
  const emotions = [...c.felt].map((k) => MOODS[k]).filter(Boolean).map((m) => ({ emoji: m.emoji, text: m.text }))
  return { kind: 'customer', id: c.id, name: c.name, age: c.age, status, came, unseen, missing, pricey, bought, total, emotions }
}

// foto de um funcionário: cargo, o que está fazendo, habilidades, energia, satisfação e salário
// actor = o ator dele na loja hoje (sem ator = não está na loja agora)
export function staffInfo(m, actor) {
  const off = isOff(m), tired = isTired(m), a = m.g === 'f' ? 'a' : 'o'
  const doing = actor?.work?.label
  let status = 'Fora da loja agora'
  if (off) status = 'De folga hoje'
  else if (actor) status = doing ? doing : 'Aguardando tarefa'
  if (tired && !off) status += ' (cansad' + a + ')'
  const busy = Math.round(workLoad(m) * 100)
  return {
    kind: 'staff', id: m.id, name: m.name, g: m.g, look: m.look, roleLabel: roleName(m.role, m.g), status,
    skill: m.skill, speed: m.speed, level: m.level, xp: Math.round((m.xp / levelXp(m.level)) * 100),
    energy: Math.round(m.energy), morale: Math.round(m.morale),
    wage: m.wage, fair: fairWage(m.role, m.skill, m.speed), hiredDay: m.hiredDay ?? null,
    request: requestText(m) || null, busy,
  }
}

