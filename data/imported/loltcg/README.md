# playloltcg 数据导入说明

本目录存放从 `https://playloltcg.com/card.html` 抓取并整理的离线 JSON 数据。

## 抓取命令

```bash
npm run fetch:loltcg
```

脚本位置：`scripts/fetch-loltcg-data.mjs`

## 目录结构

- `raw/`：接口原始数据
  - `api-manifest.json`
  - `dict-card_category.json`
  - `dict-card_color.json`
  - `dict-card_rarity.json`
  - `products.json`
  - `cards-all.json`
- `normalized/`：按项目需求归一化后的拆分文件
  - `index.json`
  - `legends.json`
  - `heroes.json`
  - `battlefields.json`
  - `runes.json`
  - `units.json`
  - `spells.json`
  - `equipment.json`
  - `indicators.json`
  - `exclusives.json`
  - `all-cards.json`

## 字段映射说明

- 统一 ID：`lol_{sourceId}`
- 项目公共字段：
  - `id`
  - `name`
  - `image`
  - `description`
- 项目分类字段：
  - `projectKind`: `legend | hero | battlefield | rune | main`
  - `projectMainType`: `unit | spell | equipment | wandering | defense`（仅 `projectKind=main`）
  - `projectRuneColor`: `red | blue | green | purple | null`（仅 `projectKind=rune`）
- 官方原始扩展字段保留在 `official` 对象中。

## 注意

- 这些文件仅用于离线分析与后续接入准备。
- 当前尚未接入项目运行逻辑，不会影响 `src/data/` 的现有数据。
