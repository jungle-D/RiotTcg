---
name: RiotTcg
description: 深色竞技风 LoL TCG 在线卡组与对战界面
colors:
  canvas-deep: "#131722"
  canvas-mid: "#1d2433"
  surface-raised: "#1c2433"
  surface-sunken: "#101623"
  surface-panel: "#243149"
  border-default: "#38445d"
  border-strong: "#4a5f82"
  border-focus: "#6fa5ff"
  ink-primary: "#e8ecf1"
  ink-secondary: "#afb8ca"
  ink-muted: "#b8c2d4"
  accent-blue: "#6fa5ff"
  accent-blue-deep: "#3660b3"
  accent-glow: "#8ec5ff"
  status-ok-bg: "#204934"
  status-ok-fg: "#80f1b0"
  status-warn-bg: "#4c3222"
  status-warn-fg: "#ffc68f"
  status-error: "#ff9d9d"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent-blue-deep}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-default:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card-section:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "14px"
  input-field:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: RiotTcg

## Overview

**Creative North Star: "The Official Table"**

RiotTcg 的视觉像一张被点亮的竞技牌桌：深色空间托住卡牌与区域，蓝色强调引导注意力，不抢实体卡面的戏。界面服务朋友局节奏——组牌、建房、对局——每个面板都应像游戏 HUD，而非通用 SaaS 后台。

整体密度中等偏高：对战棋盘信息多，但用表面层级（深底 / 抬升面板 / 高亮横幅）分区，避免一整屏平灰。明确拒绝泛 AI 奶油底、糖果色手游壳、以及脱离 TCG 语境的装饰动效。

**Key Characteristics:**

- 深色径向背景（`#1d2433` → `#131722`）营造竞技夜场感
- 蓝色强调（`#6fa5ff` / `#3660b3`）用于主操作与阶段提示
- 12px 圆角卡片容器 + 8px 控件圆角，偏利落而非软萌
- 阴影极少；深度靠背景色差与 1px 边框完成
- 中文界面文案短句、状态先行（横幅、色条、角标）

## Colors

竞技夜场_palette：冷灰蓝底 + 克制电蓝高光，卡牌图像保留最大色彩面积。

### Primary

- **Arena Blue** (`#6fa5ff`): 焦点边框、阶段横幅文字、交互高亮、选中描边。
- **Summon Blue** (`#3660b3`): 主按钮填充、关键 CTA（创建房间、确认操作）。

### Neutral

- **Canvas Deep** (`#131722`): 页面根背景；`body` 径向渐变终点。
- **Canvas Mid** (`#1d2433`): 径向渐变中心，增加顶部微光。
- **Surface Raised** (`#1c2433`): 卡组区块、大厅条、模态内容区外框。
- **Surface Sunken** (`#101623`): 输入框、模态内底、幽灵按钮底。
- **Surface Panel** (`#243149`): 状态条、进度提示条背景。
- **Ink Primary** (`#e8ecf1`): 标题与正文主色。
- **Ink Secondary** (`#afb8ca`): 副标题、说明文字。
- **Ink Muted** (`#b8c2d4`): 辅助提示、次要标注。
- **Border Default** (`#38445d`): 卡片与面板默认描边。
- **Border Strong** (`#4a5f82`): 输入框、阶段横幅外框。

### Tertiary

- **Status OK** (`#80f1b0` on `#204934`): 校验通过、完成态角标。
- **Status Warn** (`#ffc68f` on `#4c3222`): 待完成、警告角标。
- **Status Error** (`#ff9d9d`): 表单错误、恢复失败提示。

### Named Rules

**The Card-First Rule.** 背景与面板保持低饱和；强调色只出现在可点击控件、阶段提示和焦点态，不把整屏染蓝。

## Typography

**Display Font:** Inter（system-ui 栈）
**Body Font:** Inter（system-ui 栈）

**Character:** 无衬线、偏竞技工具感；字号阶梯紧凑，服务信息密度而非杂志排版。

### Hierarchy

- **Display** (600, 30px, 1.2): 页面主标题（卡组构建、对战页头）。
- **Headline** (600, 24px, 1.25): 模态标题、重要区块标题。
- **Title** (600, 18px, 1.3): 卡组分区卡片标题。
- **Body** (400, 14px, 1.45): 默认正文、按钮、状态条；长说明控制在 65–75ch 内。
- **Label** (600, 12px, 1.3): 角标状态（ok / warn）、小标签。

### Named Rules

**The HUD Rule.** 对战界面优先 14px 正文与半粗状态字；不要用超大展示字号抢占棋盘空间。

## Elevation

系统以**色调分层**为主，阴影为辅。深度通过 `#131722` → `#1c2433` → `#243149` 三级表面完成；边框 `1px solid #38445d` 界定区域。发光仅用于焦点与阶段提示（如 `box-shadow: 0 0 12px rgba(111, 165, 255, 0.2)`），不作为默认卡片投影。

### Shadow Vocabulary

- **Focus Glow** (`0 0 0 2px #6fa5ff, 0 0 16px rgba(111, 165, 255, 0.35)`): 换牌高亮、输入聚焦。
- **Prompt Glow** (`0 0 12px rgba(111, 165, 255, 0.2)`): 当前行动提示条。

### Named Rules

**The Flat Surface Rule.** 面板默认无投影；只有「现在轮到你」类状态才加光晕。

## Components

### Buttons

- **Shape:** 8px 圆角，紧凑内边距（默认 `6px 12px`，大厅 CTA `10px 18px`）。
- **Primary:** `#3660b3` 填充 + `#f6f8ff` 字色；用于主路径操作。
- **Default:** `#2f4262` 填充 + `#5e7398` 边框；次要操作。
- **Ghost:** `#1a2232` 填充；取消、返回类操作。
- **Hover / Focus:** 边框转 `#6fa5ff`；输入类控件加 2px 蓝色外发光。
- **Disabled:** `opacity: 0.5`，指针 `not-allowed`。

### Cards / Containers

- **Corner Style:** 12px（`.section-card`、大厅条）；模态 14px。
- **Background:** `#1c2433` 抬升于 `#131722` 画布。
- **Border:** 1px `#38445d`；可点击卡片 hover 时边框 `#6fa5ff`。
- **Internal Padding:** 14–16px；网格间距 14px。

### Inputs / Fields

- **Style:** `#101623` 底 + `#4a5f82` 描边 + 8px 圆角。
- **Focus:** 描边 `#6fa5ff`，无默认 outline。
- **Error:** 文案 `#ff9d9d`，与 `.app-restore-error` 浅红底一致。

### Navigation

- 页内以顶部标题 + 返回按钮为主，无全局侧栏。返回多用 Ghost 按钮，保持棋盘全宽。

### Game Board Zones

- **Signature Component:** 对战区域用 CSS 变量缩放（`--ui-scale: 0.75`）统一卡牌与区域尺寸；区域标签半粗、横幅蓝字 `#8ec5ff` 提示当前阶段。

## Do's and Don'ts

### Do:

- **Do** 用 `#243149` 状态条 + 左侧 `#6fa5ff` 强调边表达「当前行动」。
- **Do** 让卡牌图像是屏幕上最饱和的元素；UI /chrome 保持灰蓝低调。
- **Do** 复用 `.btn` / `.section-card` / `.modal` 既有模式，保证组牌与对局视觉一致。
- **Do** 错误与恢复提示用短句中文 + `#ff9d9d`，放在操作附近。

### Don't:

- **Don't** 使用奶油暖灰底或高饱和渐变背景——破坏竞技夜场感。
- **Don't** 为装饰加 bounce / elastic 动效；状态变化应短、干脆。
- **Don't** 嵌套卡片容器；棋盘区域用边框分区，不再套第二层卡片。
- **Don't** 用低对比灰字（`#afb8ca` 及以下）承载关键规则说明。
