// Miniaturas 3D dos móveis da construção: o renderizador registra como montar cada modelo; a imagem sai de uma cena temporária.
import { snapshot } from './assets.js'

let maker = null
const cache = {}
export const setThumbMaker = (fn) => { maker = fn }
// key: 'shelf:std' | 'shelf:wall' | 'shelf:corner' | 'produce:island' | 'produce:wall' | 'fridge' | 'meat'
export function buildThumb(key) {
  if (cache[key] !== undefined) return cache[key]
  if (!maker) return null
  try { cache[key] = snapshot(() => maker(key), 128) } catch (e) { cache[key] = null }
  return cache[key]
}
