// Gerador de pessoas para a equipe: não depende do estado do jogo, só da configuração.
import { STAFF, NAMES } from './config.js'

const LOOKS = { f: 6, m: 7 } // modelos female-a…f e male-a…g do Mini Characters
let seq = 0

// competência e velocidade vão de 1 a 5; a maioria fica no meio, 5 é raro
export function rollStat() {
  return Math.max(1, Math.min(5, Math.round((Math.random() + Math.random()) * 2 + 1)))
}
// salário justo para o cargo, pelo que a pessoa sabe fazer
// competência pesa mais que velocidade, e quem tem as duas altas cobra um extra
export function fairWage(role, skill, speed) {
  return Math.round(STAFF[role].wage * (0.55 + 0.09 * skill + 0.06 * speed) * (skill >= 4 && speed >= 4 ? 1.15 : 1))
}
export const roleName = (role, g) => (g === 'f' && STAFF[role].nameF) || STAFF[role].name

// taken = nomes já usados na equipe e no catálogo, para não repetir
export function makePerson(role, o = {}, taken = new Set()) {
  const g = o.g || (Math.random() < 0.5 ? 'f' : 'm')
  const free = NAMES[g].filter((n) => !taken.has(n))
  const list = free.length ? free : NAMES[g]
  // quem é rápido e muito competente ao mesmo tempo é difícil de achar: sorteios com soma alta são descartados na maioria das vezes
  let skill = o.skill ?? rollStat(), speed = o.speed ?? rollStat()
  if (o.skill == null && o.speed == null) for (let i = 0; i < 8 && Math.random() > (skill + speed >= 9 ? 0.25 : skill + speed >= 8 ? 0.55 : 1); i++) { skill = rollStat(); speed = rollStat() }
  const wage = o.wage ?? Math.max(15, Math.round(fairWage(role, skill, speed) * (0.85 + Math.random() * 0.3)))
  return {
    id: `p${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    name: list[Math.floor(Math.random() * list.length)],
    g, look: Math.floor(Math.random() * LOOKS[g]),
    role, skill, speed, wage,
    level: 1, xp: 0, energy: 100, morale: 70,
    request: null, off: 0, gear: false, lastOff: 0, work: 0, lastLoad: null, lastScore: null,
  }
}
