// Equipe: contratação pelo catálogo de candidatos, níveis, energia, satisfação e pedidos dos funcionários.
import { game, toast, money } from './state.js'
import { STAFF, TEAM, REQUESTS, levelXp } from './config.js'
import { makePerson, fairWage, roleName } from './people.js'

export { roleName, fairWage }
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v))

export const teamOf = (role) => game.team.filter((m) => m.role === role)
export const isOff = (m) => m.off === game.day
// quem trabalha hoje (folga combinada fica em casa)
export const onDuty = (role) => game.team.filter((m) => m.role === role && !isOff(m)).length
export const memberById = (id) => game.team.find((m) => m.id === id)
export const memberRole = (m) => roleName(m.role, m.g)
export const underpaid = (m) => m.wage < fairWage(m.role, m.skill, m.speed) * 0.95

// ---------- desempenho ----------
export const isTired = (m) => m.energy < TEAM.tired
// multiplica a velocidade de andar: velocidade 3 ≈ 1,05×; cansado anda mais devagar
export const walkMult = (m) => (0.75 + 0.1 * m.speed) * (isTired(m) ? 0.75 : 1)
// multiplica a duração das tarefas (menor = mais rápido): competência 3 ≈ 1,25×
export const workMult = (m) => (1.55 - 0.1 * m.skill) * (isTired(m) ? 1.3 : 1) * (m.morale < 35 ? 1.1 : 1)
// ritmo do caixa: competência 3 = ritmo de referência
export const serveMult = (m) => (0.7 + 0.1 * m.skill) * (isTired(m) ? 0.8 : 1)

export function gainMemberXp(m, n = 1) {
  if (!m) return
  m.xp += n
  while (m.xp >= levelXp(m.level)) {
    m.xp -= levelXp(m.level)
    m.level++
    // sobe alternando competência e velocidade, até o máximo de 5
    const order = m.level % 2 === 0 ? ['skill', 'speed'] : ['speed', 'skill']
    const stat = order.find((k) => m[k] < 5)
    if (stat) m[stat]++
    toast(stat ? `${m.name} subiu para o nível ${m.level}: ${stat === 'skill' ? 'competência' : 'velocidade'} +1` : `${m.name} subiu para o nível ${m.level}`, 'good')
  }
}

// ---------- catálogo de candidatos ----------
const takenNames = () => new Set([...game.team, ...game.candidates].map((m) => m.name))
function newCandidate() {
  // cargos da cafeteria só aparecem depois de instalar a cafeteria; cargos com vaga aberta e pouco representados no catálogo aparecem mais
  const roles = Object.keys(STAFF).filter((r) => r !== 'barista' || game.cafe)
  const weight = (r) => (teamOf(r).length < STAFF[r].max ? 1.5 : 0.4) / (1 + game.candidates.filter((c) => c.role === r).length)
  let x = Math.random() * roles.reduce((s, r) => s + weight(r), 0), role = roles[0]
  for (const r of roles) if ((x -= weight(r)) <= 0) { role = r; break }
  return makePerson(role, {}, takenNames())
}
export function ensureCandidates() {
  while (game.candidates.length < TEAM.candidates) game.candidates.push(newCandidate())
}
// troca alguns candidatos a cada manhã
export function rotateCandidates(n = TEAM.newPerDay) {
  game.candidates.splice(0, Math.min(n, game.candidates.length))
  ensureCandidates()
}
export function postJobAd() {
  if (game.money < TEAM.adCost) return toast('Caixa insuficiente para o anúncio', 'bad')
  game.money -= TEAM.adCost
  game.candidates = []
  ensureCandidates()
  toast(`Anúncio de vaga publicado por ${money(TEAM.adCost)}: ${TEAM.candidates} novos candidatos`, 'good')
}
export function hireBlock(c) {
  const s = STAFF[c.role]
  if (teamOf(c.role).length >= s.max) return s.max === 1 ? 'Vaga já ocupada' : 'Vagas ocupadas'
  if (c.role === 'barista' && !game.cafe) return 'Instale a cafeteria primeiro'
  if (game.money < s.hire) return 'Caixa insuficiente'
  return null
}
export function hireCandidate(id) {
  const c = game.candidates.find((x) => x.id === id)
  if (!c) return
  const why = hireBlock(c)
  if (why) return toast(why, 'bad')
  game.money -= STAFF[c.role].hire
  game.candidates.splice(game.candidates.indexOf(c), 1)
  c.hiredDay = game.day
  game.team.push(c)
  ensureCandidates()
  toast(`${c.name} contratad${c.g === 'f' ? 'a' : 'o'} como ${memberRole(c).toLowerCase()} por ${money(c.wage)}/dia`, 'good')
}
export const severance = (m) => Math.round(m.wage * TEAM.severance)
export function fireMember(id) {
  const m = memberById(id)
  if (!m) return
  const cost = severance(m)
  game.money -= cost
  game.team.splice(game.team.indexOf(m), 1)
  toast(`${m.name} foi desligad${m.g === 'f' ? 'a' : 'o'}. Rescisão: ${money(cost)}`)
}

// ---------- pedidos dos funcionários ----------
export function requestText(m) {
  const r = m.request
  if (!r) return ''
  if (r.type === 'raise') return `Quer aumento de ${money(m.wage)} para ${money(r.wage)} por dia`
  if (r.type === 'dayoff') return 'Pediu folga amanhã (o salário do dia é pago)'
  if (r.type === 'course') return `Quer fazer um curso de ${money(r.cost)}: competência +1`
  return `Pediu ${m.role === 'cashier' || m.role === 'barista' ? 'uma cadeira confortável' : 'um tênis confortável'} de ${money(r.cost)}: cansa 40% menos`
}
export const pendingRequests = () => game.team.filter((m) => m.request)
export function makeRequest(m) {
  const fair = fairWage(m.role, m.skill, m.speed)
  const opts = [
    ['raise', underpaid(m) ? 4 : 0.6],
    ['dayoff', game.day - (m.lastOff || 0) > 5 ? 1 : 0],
    ['course', m.skill < 5 ? 0.8 : 0],
    ['gear', m.gear ? 0 : 0.7],
  ].filter(([, w]) => w > 0)
  let r = Math.random() * opts.reduce((s, [, w]) => s + w, 0), type = opts[0]?.[0]
  for (const [t, w] of opts) if ((r -= w) <= 0) { type = t; break }
  if (!type) return null
  const base = { type, day: game.day }
  if (type === 'raise') return { ...base, wage: Math.max(m.wage + 3, Math.round(Math.max(fair, m.wage * 1.12))) }
  if (type === 'course' || type === 'gear') return { ...base, cost: REQUESTS[type].cost }
  return base
}
export function answerRequest(id, yes) {
  const m = memberById(id)
  const r = m?.request
  if (!r) return
  const def = REQUESTS[r.type]
  if (yes) {
    if (r.cost && game.money < r.cost) return toast('Caixa insuficiente', 'bad')
    if (r.cost) game.money -= r.cost
    if (r.type === 'raise') m.wage = r.wage
    if (r.type === 'dayoff') { m.off = game.day + 1; m.lastOff = game.day + 1 }
    if (r.type === 'course') m.skill = Math.min(5, m.skill + 1)
    if (r.type === 'gear') m.gear = true
    toast(r.type === 'dayoff' ? `${m.name} folga amanhã` : `${def.name} aprovado para ${m.name}`, 'good')
  } else toast(`${def.name} recusado. ${m.name} ficou chatead${m.g === 'f' ? 'a' : 'o'}`)
  m.morale = clamp(m.morale + (yes ? def.yes : def.no))
  m.request = null
}

// ---------- energia: gasta no expediente, volta no almoço e à noite ----------
export function restTeam(amount) {
  for (const m of game.team) m.energy = clamp(m.energy + amount)
}

// ---------- manhã: descanso, folgas, satisfação, pedidos novos e quem pede demissão ----------
export function teamMorning() {
  const notes = []
  for (const m of [...game.team]) {
    // dia puxado e salário abaixo do justo pesam na satisfação; o resto volta devagar ao normal
    if (m.energy < 20) m.morale -= 5
    if (underpaid(m)) m.morale -= 4
    m.morale = clamp(m.morale + (m.morale < 60 ? 3 : m.morale > 75 ? -1 : 0))
    m.energy = 100
    // pedido sem resposta por muito tempo conta como recusa, com metade do peso
    if (m.request && game.day - m.request.day >= TEAM.requestDays) {
      m.morale = clamp(m.morale + Math.round(REQUESTS[m.request.type].no / 2))
      notes.push(`${m.name} desistiu do pedido de ${REQUESTS[m.request.type].name.toLowerCase()} sem resposta`)
      m.request = null
    }
    if (m.morale < TEAM.quitMorale) {
      game.team.splice(game.team.indexOf(m), 1)
      notes.push(`${m.name} pediu demissão: estava insatisfeit${m.g === 'f' ? 'a' : 'o'}`)
      continue
    }
    if (isOff(m)) notes.push(`${m.name} está de folga hoje`)
  }
  const open = () => pendingRequests().length
  for (const m of game.team) {
    if (open() >= TEAM.maxRequests || m.request) continue
    if (Math.random() > TEAM.requestChance + (underpaid(m) ? 0.25 : 0)) continue
    m.request = makeRequest(m)
    if (m.request) notes.push(`${m.name} tem um pedido para você na Equipe do computador`)
  }
  rotateCandidates()
  for (const n of notes) toast(n, /demissão/.test(n) ? 'bad' : 'info')
}
