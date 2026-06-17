import { useMemo, useState } from 'react'
import legendsData from '../../data/imported/loltcg/normalized/legends.json'
import heroesData from '../../data/imported/loltcg/normalized/heroes.json'
import mappingData from '../../data/imported/loltcg/normalized/legend2hero.json'
import './LegendHeroMappingPage.css'

interface ImportedCard {
  id: string
  name: string
  image: string
  official?: {
    hero?: string
    cardNo?: string
  }
}

interface LegendHeroMappingFile {
  version: number
  updatedAt: string
  mapping: Record<string, string[]>
}

interface LegendHeroMappingPageProps {
  onBack: () => void
}

const legends = legendsData as ImportedCard[]
const heroes = heroesData as ImportedCard[]
const initialMapping = mappingData as LegendHeroMappingFile

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function saveWithFilePicker(filename: string, content: string): Promise<boolean> {
  type PickerWindow = Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string
      types?: Array<{ description?: string; accept: Record<string, string[]> }>
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: string) => Promise<void>
        close: () => Promise<void>
      }>
    }>
  }

  const targetWindow = window as PickerWindow
  if (!targetWindow.showSaveFilePicker) {
    return false
  }

  try {
    const handle = await targetWindow.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'JSON File',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    return true
  } catch {
    return false
  }
}

function LegendHeroMappingPage({ onBack }: LegendHeroMappingPageProps) {
  const [selectedLegendId, setSelectedLegendId] = useState<string>(legends[0]?.id ?? '')
  const [mapping, setMapping] = useState<Record<string, string[]>>(initialMapping.mapping ?? {})
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')

  const selectedHeroIds = mapping[selectedLegendId] ?? []

  const filteredHeroes = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) {
      return heroes
    }
    return heroes.filter((hero) => {
      const heroAlias = hero.official?.hero ?? ''
      return (
        hero.name.toLowerCase().includes(q) ||
        heroAlias.toLowerCase().includes(q) ||
        hero.id.toLowerCase().includes(q)
      )
    })
  }, [keyword])

  const mappedCount = useMemo(
    () => Object.keys(mapping).filter((legendId) => (mapping[legendId] ?? []).length > 0).length,
    [mapping],
  )

  const toggleHero = (heroId: string) => {
    if (!selectedLegendId) {
      return
    }
    setMapping((prev) => {
      const current = prev[selectedLegendId] ?? []
      const exists = current.includes(heroId)
      const next = exists ? current.filter((id) => id !== heroId) : [...current, heroId]
      return {
        ...prev,
        [selectedLegendId]: next,
      }
    })
  }

  const saveJson = async () => {
    const payload: LegendHeroMappingFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      mapping,
    }
    const content = `${JSON.stringify(payload, null, 2)}\n`
    const filename = 'legend2hero.json'
    const saved = await saveWithFilePicker(filename, content)
    if (!saved) {
      downloadJson(filename, content)
      setStatus('未检测到文件系统写入权限，已下载 legend2hero.json，请手动覆盖到 data/imported/loltcg/normalized/。')
      return
    }
    setStatus('已保存 legend2hero.json，请放置到 data/imported/loltcg/normalized/ 并重新构建。')
  }

  return (
    <main className="mapping-page">
      <header className="mapping-header">
        <div>
          <h1>传奇-英雄映射配置</h1>
          <p>按卡牌 id 手动维护映射：一个传奇可对应多个英雄单位。</p>
        </div>
        <div className="mapping-actions">
          <button type="button" className="btn ghost" onClick={onBack}>
            返回构筑
          </button>
          <button type="button" className="btn primary" onClick={saveJson}>
            保存为 legend2hero.json
          </button>
        </div>
      </header>

      <section className="mapping-meta">
        <p>传奇总数：{legends.length}</p>
        <p>英雄总数：{heroes.length}</p>
        <p>已配置传奇：{mappedCount}</p>
      </section>

      {status ? <p className="mapping-status">{status}</p> : null}

      <section className="mapping-layout">
        <aside className="legend-list">
          {legends.map((legend) => (
            <button
              key={legend.id}
              type="button"
              className={`legend-item ${selectedLegendId === legend.id ? 'active' : ''}`}
              onClick={() => setSelectedLegendId(legend.id)}
            >
              <img src={legend.image} alt={legend.name} />
              <div>
                <strong>{legend.name}</strong>
                <p>{legend.id}</p>
                <span>已选英雄：{(mapping[legend.id] ?? []).length}</span>
              </div>
            </button>
          ))}
        </aside>

        <section className="hero-panel">
          <div className="hero-toolbar">
            <h2>英雄多选</h2>
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按名称 / 官方英雄名 / ID 搜索"
            />
          </div>
          <div className="hero-grid">
            {filteredHeroes.map((hero) => {
              const checked = selectedHeroIds.includes(hero.id)
              return (
                <label key={hero.id} className={`hero-item ${checked ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHero(hero.id)}
                  />
                  <img src={hero.image} alt={hero.name} />
                  <strong>{hero.name}</strong>
                  <small>{hero.official?.hero ?? '-'}</small>
                  <small>{hero.id}</small>
                </label>
              )
            })}
          </div>
        </section>
      </section>
    </main>
  )
}

export default LegendHeroMappingPage
