import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const API_BASE = 'https://lol-api.playloltcg.com'
const OUTPUT_ROOT = path.resolve('data/imported/loltcg')
const RAW_DIR = path.join(OUTPUT_ROOT, 'raw')
const NORMALIZED_DIR = path.join(OUTPUT_ROOT, 'normalized')

const DICT_TYPES = ['card_category', 'card_color', 'card_rarity']
const RUNE_COLOR_SET = new Set(['red', 'blue', 'green', 'purple'])
const CARD_PAGE_SIZE = 100
const REQUEST_DELAY_MS = 240
const MAX_RETRY = 3

const MAIN_TYPE_BY_CATEGORY = {
  unit: 'unit',
  spell: 'spell',
  equipment: 'equipment',
  exclusive_unit: 'unit',
  exclusive_spell: 'spell',
  exclusive_equipment: 'equipment',
  indicator_unit: 'unit',
  indicator_battlefield: 'wandering',
  indicator_equipment: 'defense',
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(endpoint, payload) {
  let lastError = null
  for (let i = 1; i <= MAX_RETRY; i += 1) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error(`${endpoint} HTTP ${response.status}`)
      }
      const body = await response.json()
      if (body.code !== 0) {
        throw new Error(`${endpoint} API code=${body.code} message=${body.message ?? ''}`)
      }
      return { body, status: response.status }
    } catch (error) {
      lastError = error
      if (i < MAX_RETRY) {
        await sleep(REQUEST_DELAY_MS * i)
      }
    }
  }
  throw lastError
}

async function fetchAllCards(manifest) {
  const endpoint = '/xcx/card/searchCardCraftWeb'
  const cards = []
  let total = null
  let pageNum = 1

  while (true) {
    const payload = {
      pageNum,
      pageSize: CARD_PAGE_SIZE,
      searchContent: '',
      cardCategoryList: [],
      cardColorList: [],
      rarityList: [],
      productCodeList: [],
    }
    const startedAt = Date.now()
    const { body, status } = await fetchJson(endpoint, payload)
    const elapsedMs = Date.now() - startedAt
    const list = body.result?.list ?? []
    total = body.result?.total ?? total
    cards.push(...list)

    manifest.push({
      endpoint,
      request: payload,
      status,
      elapsedMs,
      count: list.length,
      total,
      timestamp: new Date().toISOString(),
      traceId: body.traceId ?? null,
    })

    if (list.length < CARD_PAGE_SIZE || (typeof total === 'number' && cards.length >= total)) {
      break
    }
    pageNum += 1
    await sleep(REQUEST_DELAY_MS)
  }

  return { cards, total: total ?? cards.length }
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return ''
  return text.trim()
}

function projectKindFromCategory(category) {
  if (category === 'legendary') return 'legend'
  if (category === 'hero_unit') return 'hero'
  if (category === 'battlefield') return 'battlefield'
  if (category === 'rune') return 'rune'
  return 'main'
}

function normalizeCard(card) {
  const projectKind = projectKindFromCategory(card.cardCategory)
  const normalized = {
    id: `lol_${card.id}`,
    name: sanitizeText(card.cardName),
    image: sanitizeText(card.frontImage),
    description: sanitizeText(card.cardEffect) || sanitizeText(card.flavorText),
    projectKind,
    projectMainType: projectKind === 'main' ? MAIN_TYPE_BY_CATEGORY[card.cardCategory] ?? 'unit' : undefined,
    projectRuneColor:
      projectKind === 'rune'
        ? card.cardColorList?.find((color) => RUNE_COLOR_SET.has(color)) ?? null
        : undefined,
    official: {
      sourceId: card.id,
      cardNo: card.cardNo ?? '',
      cardCategory: card.cardCategory,
      cardCategoryName: card.cardCategoryName,
      cardColorList: Array.isArray(card.cardColorList) ? card.cardColorList : [],
      rarity: card.rarity ?? '',
      rarityName: card.rarityName ?? '',
      extendRarity: card.extendRarity ?? '',
      extendRarityName: card.extendRarityName ?? '',
      energy: card.energy ?? null,
      returnEnergy: card.returnEnergy ?? null,
      power: card.power ?? null,
      hero: card.hero ?? '',
      region: card.region ?? '',
      tag: card.tag ?? '',
      artist: card.artist ?? '',
      flavorText: card.flavorText ?? '',
      productCodeList: Array.isArray(card.productCodeList) ? card.productCodeList : [],
      productNameList: Array.isArray(card.productNameList) ? card.productNameList : [],
      frontImage: card.frontImage ?? '',
      backImage: card.backImage ?? '',
      status: card.status ?? null,
      cardGroupLimit: card.cardGroupLimit ?? null,
    },
  }
  return normalized
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true })
  await mkdir(NORMALIZED_DIR, { recursive: true })

  const manifest = []

  const dictMap = {}
  for (const type of DICT_TYPES) {
    const endpoint = '/xcx/dict/getDictList'
    const payload = { pageNum: 1, pageSize: 100, type }
    const startedAt = Date.now()
    const { body, status } = await fetchJson(endpoint, payload)
    const elapsedMs = Date.now() - startedAt
    dictMap[type] = body.result ?? []
    manifest.push({
      endpoint,
      request: payload,
      status,
      elapsedMs,
      count: dictMap[type].length,
      timestamp: new Date().toISOString(),
      traceId: body.traceId ?? null,
    })
    await sleep(REQUEST_DELAY_MS)
  }

  const productsEndpoint = '/xcx/product/getProductList'
  const productsPayload = { pageNum: 1, pageSize: 1000 }
  const productStartedAt = Date.now()
  const { body: productsBody, status: productsStatus } = await fetchJson(productsEndpoint, productsPayload)
  const productsElapsedMs = Date.now() - productStartedAt
  const products = productsBody.result ?? []
  manifest.push({
    endpoint: productsEndpoint,
    request: productsPayload,
    status: productsStatus,
    elapsedMs: productsElapsedMs,
    count: products.length,
    timestamp: new Date().toISOString(),
    traceId: productsBody.traceId ?? null,
  })
  await sleep(REQUEST_DELAY_MS)

  const { cards, total } = await fetchAllCards(manifest)

  await writeJson(path.join(RAW_DIR, 'dict-card_category.json'), dictMap.card_category)
  await writeJson(path.join(RAW_DIR, 'dict-card_color.json'), dictMap.card_color)
  await writeJson(path.join(RAW_DIR, 'dict-card_rarity.json'), dictMap.card_rarity)
  await writeJson(path.join(RAW_DIR, 'products.json'), products)
  await writeJson(path.join(RAW_DIR, 'cards-all.json'), cards)
  await writeJson(path.join(RAW_DIR, 'api-manifest.json'), manifest)

  const normalized = cards.map(normalizeCard)
  const groups = {
    legends: normalized.filter((item) => item.official.cardCategory === 'legendary'),
    heroes: normalized.filter((item) => item.official.cardCategory === 'hero_unit'),
    battlefields: normalized.filter((item) => item.official.cardCategory === 'battlefield'),
    runes: normalized.filter((item) => item.official.cardCategory === 'rune'),
    units: normalized.filter((item) => item.official.cardCategory === 'unit'),
    spells: normalized.filter((item) => item.official.cardCategory === 'spell'),
    equipment: normalized.filter((item) => item.official.cardCategory === 'equipment'),
    indicators: normalized.filter((item) => item.official.cardCategory.startsWith('indicator_')),
    exclusives: normalized.filter((item) => item.official.cardCategory.startsWith('exclusive_')),
  }

  await writeJson(path.join(NORMALIZED_DIR, 'legends.json'), groups.legends)
  await writeJson(path.join(NORMALIZED_DIR, 'heroes.json'), groups.heroes)
  await writeJson(path.join(NORMALIZED_DIR, 'battlefields.json'), groups.battlefields)
  await writeJson(path.join(NORMALIZED_DIR, 'runes.json'), groups.runes)
  await writeJson(path.join(NORMALIZED_DIR, 'units.json'), groups.units)
  await writeJson(path.join(NORMALIZED_DIR, 'spells.json'), groups.spells)
  await writeJson(path.join(NORMALIZED_DIR, 'equipment.json'), groups.equipment)
  await writeJson(path.join(NORMALIZED_DIR, 'indicators.json'), groups.indicators)
  await writeJson(path.join(NORMALIZED_DIR, 'exclusives.json'), groups.exclusives)

  const allCards = normalized.map((item) => ({
    id: item.id,
    name: item.name,
    cardNo: item.official.cardNo,
    cardCategory: item.official.cardCategory,
    cardColorList: item.official.cardColorList,
    image: item.image,
  }))
  await writeJson(path.join(NORMALIZED_DIR, 'all-cards.json'), allCards)

  const categoryCounts = normalized.reduce((acc, item) => {
    const key = item.official.cardCategory
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const warnings = []
  for (const item of normalized) {
    if (item.projectKind === 'main' && !MAIN_TYPE_BY_CATEGORY[item.official.cardCategory]) {
      warnings.push(`未映射 main 类型分类: ${item.official.cardCategory}`)
      break
    }
  }

  const index = {
    source: 'https://playloltcg.com/card.html',
    generatedAt: new Date().toISOString(),
    totals: {
      expected: total,
      fetched: cards.length,
      normalized: normalized.length,
    },
    files: {
      legends: groups.legends.length,
      heroes: groups.heroes.length,
      battlefields: groups.battlefields.length,
      runes: groups.runes.length,
      units: groups.units.length,
      spells: groups.spells.length,
      equipment: groups.equipment.length,
      indicators: groups.indicators.length,
      exclusives: groups.exclusives.length,
      allCards: allCards.length,
    },
    categoryCounts,
    warnings,
  }
  await writeJson(path.join(NORMALIZED_DIR, 'index.json'), index)

  console.log(`Fetched ${cards.length} cards (expected ${total}).`)
  console.log(`Output written to ${OUTPUT_ROOT}`)
}

main().catch((error) => {
  console.error('[fetch:loltcg] failed:', error)
  process.exitCode = 1
})
