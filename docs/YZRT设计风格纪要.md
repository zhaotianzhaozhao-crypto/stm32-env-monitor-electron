# YZRT 设计风格纪要

> 来源通读：`D:\zm\项目_其他\yzrt-master\yzrt-master`（一组纯前端 UI 演示合集，非完整业务 App）  
> 用途：指导「奶家人 / 环境监测」Electron 侧栏与操作控件的视觉统一  
> 日期：2026-11-03  
> 原则：**可复用视觉语言**；不要整仓拷贝 yzrt；业务逻辑与 3D 视口核心勿因样式被破坏

---

## 1. 总述

YZRT 仓库是若干**独立小品**（旋钮、拟态按钮、液态玻璃、导航对比、Gemini 输入壳、Launch 按钮等），没有统一 README / 设计系统文档。风格上却高度一致，可概括为：

**「浅灰青金属拟态 + 多层同心浮雕 + 灯点/指示条反馈」**

- **材质**：soft-metal / neumorphism（外凸阴影 + 内凹高光），偶发液态玻璃与深色机械按钮变体  
- **光感**：光源偏一侧（声音旋钮强调**右侧投影、左侧高光**；真实拟态旋钮偏**下方重阴影 + 上方高光**）  
- **反馈**：弧形灯点点亮、中心指示条/指示灯、激活色（白光或琥珀金 `#e3a560`）  
- **布局**：演示页多为全屏居中单控件；落地到产品侧栏时，应把同一材质语言铺到**卡片 / 按钮 / 输入 / Tab**，而不是只做一个大旋钮  
- **动效**：短过渡 `0.2s–0.25s`；按下 `scale(0.94~0.98)`；灯点可有轻微 blur 光晕；长过渡仅用于「档位扫过」类（如灯环 `transition: 2s`）

主风格锚点（优先对齐）：

1. **声音控制旋钮** — 灰青金属环、弧形灯点、中心指示条、竖向拖转/滚轮  
2. **真实拟态旋钮** — 更深的多层 inset 阴影、方向倾斜、激活琥珀图标  
3. **拟态按钮** — 外凸 / 内凹成对出现（raised vs pressed）  
4. **Gemini UI** — 双色描边壳（深边→浅边渐变框）+ 内凹聊天面  
5. **纯 CSS 液态玻璃** — 双描边高光 + `backdrop-filter` + 网格底（慎用，侧栏可读性优先）

次要参考：导航栏对比（胶囊导航明暗）、Launch Start（深色机械+蓝光扫描，偏演出）、B 站搜索栏（扁平浅灰，偏克制）、CSS 水滴（有机形变，装饰向）。

---

## 2. 通读覆盖范围

| 子目录 | 入口 | 关键样式/资源 | 风格角色 |
|--------|------|----------------|----------|
| `声音控制旋钮/` | `index.html` | `css/styles.css` | **主锚点**：金属旋钮 + 灯环 + 指示条 |
| `真实拟态旋钮/` | `index.html` | `css/styles.css` | 更深拟态、方向倾斜、琥珀激活 |
| `拟态按钮(仅演示)/` | `index.html` | `css/styles.css` | raised / inset 按钮教材 |
| `纯CSS液态玻璃/` | `index.html` | `css/styles.css` | 玻璃质感配方（侧栏慎全盘套用） |
| `Gemini UI/` | `index.html` | `css/styles.css`, `imgs/icon.svg` | 面板壳、双色边、迷你钮 |
| `launch start/` | `index.html` | `css/styles.css` | 深色机械钮 + 扫描光（特殊场景） |
| `导航栏对比/` | `index.html` | `css/styles.css`, `imgs/箭头.svg` | 胶囊导航明/暗两种对比 |
| `导航栏对比/临时/` | `index.html` | 临时样式 | 导航实验稿，风格同族 |
| `Go Pro升级按钮/` | `index.html` | `css/styles.css` | 极简黑白圆钮（弱相关） |
| `CSS水滴/` | `index.html` | `css/styles.css` | 有机 blob + 高光点（装饰） |
| `B站搜索栏/` | `index.html` | `css/styles.css` | 扁平搜索条（对比「什么不算 YZRT 金属风」） |
| 根目录 `LICENSE` | — | 文本 | 无设计说明；**无 README** |

结构共性：每子项几乎都是 `index.html` + `css/styles.css`（+ 偶发 `imgs/`），原生 HTML/CSS/少量 JS，无构建链。

---

## 3. 色板 Token（建议）

### 3.1 金属主色（来自声音控制旋钮，应作为产品默认）

| 角色 | 建议变量 | 色值 | 用法 |
|------|----------|------|------|
| 高光面 | `--yz-metal-hi` | `#eaefed` | 外环亮侧、按钮上沿 |
| 中面 | `--yz-metal-mid` | `#dfe4e1` | 面板底、旋钮外圈 |
| 暗面 | `--yz-metal-lo` | `#bfc9ca` | 渐变暗侧 |
| 深凹 | `--yz-metal-deep` | `#95a7ae` | 内圈/凹陷底 |
| 墨字 | `--yz-metal-ink` | `#2a3a3e` | 主文字（比纯黑更「金属面板上的字」） |
| 静默 | `--yz-metal-mute` | `#6a7d83` | 次级字、熄灭灯点 |
| 描边 | `--yz-rim` | `#c6ccca` | `1.5px solid` 圆环/卡片边 |
| 发光 | `--yz-glow` | `#ffffff` | 灯点 act、指示条 |
| 弱强调 | `--yz-accent` | `#5b8fa3` | 聚焦环、链接色（低饱和） |
| 强强调 | `--yz-accent-strong` | `#3d6f82` | 激活文字 |

背景洗色（页面级）：`#D2DEDA → #C1D0D4`（横渐变）；可选模糊光斑 `#D3DFDD → #aec2ca`。

### 3.2 拟态中性灰（拟态按钮 / 水滴底）

- 底：`#e3e5e7` / `#f3f3f3` / `#f4f6f8`  
- 暗影块：`#b1b4b5` / `#b9bcbd`  
- 亮影块：`#fafafd` / `#ffffff`  
- 字：`#474747`

### 3.3 真实拟态旋钮补充

- 外环：`#f5f8fa → #9da4a8`  
- 柄：`#c5d1da`  
- **激活琥珀**：`#e3a560` / `#eaa75d` / `#f1b475`（方向选中、告警偏暖可用）

### 3.4 Gemini 冷灰蓝变体

- `--normal-bg: #E1E9F1`  
- `--normal-text: #111b2d`  
- `--dark-border: #92a8c1`  
- `--light-border: #fefeff`  
适用「大输入壳 / 对话条」，与灰青金属可混用但不要一页三套主色。

### 3.5 深色机械（Launch，可选皮肤）

- 底：`#4A494E → #828186`  
- 扫描蓝：`#66a7fb`  
仅用于「启动/危险确认」等少数控件，不作侧栏默认。

---

## 4. 材质与阴影规范

### 4.1 外凸（Raised）

声音旋钮中心钮典型配方（**水平偏置**，像侧面打光）：

```css
box-shadow:
  -11px 0 14px rgba(255, 255, 255, 0.4),   /* 左高光 */
   4px 0  8px rgba(2, 29, 37, 0.1),
  22px 0 28px rgba(2, 29, 37, 0.6),         /* 右深投影 */
  inset -2px 0 2px rgba(1, 22, 25, 0.4),
  inset  2px 0 2px rgba(255, 255, 255, 0.4);
```

拟态按钮对角配方：

```css
box-shadow: 8px 8px 16px #b1b4b5, -8px -8px 16px #fafafd;
background-image: linear-gradient(145deg, #f4f6f8, #b1b4b5);
```

### 4.2 内凹（Inset / Well）

```css
box-shadow:
  inset 1px 1px 2px rgba(255, 255, 255, 0.55),
  inset -1px -1px 1px rgba(156, 170, 169, 0.55);
border: 1.5px solid #c6ccca;
```

输入框、Tab 槽、设备控制嵌板应用此式。

### 4.3 多层同心

旋钮/仪表：**外圈渐变 → 中圈 inset 边 → 内钮 raised**。产品里卡片也可「外板 raised + 内区 inset」。

### 4.4 玻璃（可选）

液态玻璃要点：极淡 `background: rgba(255,255,255,0.04)`、`backdrop-filter: blur(2px)`、多重 inset 高光、外圈暗 blur 伪元素。侧栏信息密度高时，**优先金属拟态，玻璃只做标题栏/浮层**。

---

## 5. 控件规范

### 5.1 旋钮 / 档位

- 角度窗示例：`-112.5° ~ +112.5°`（声音旋钮）  
- 反馈：弧上灯点 `span` 默认 `#6a7d83`，激活白 + `box-shadow: 0 0 5px #fff` + 轻 blur  
- 中心指示：竖条胶囊 `border-radius: 99px`，白渐变  
- 交互：竖向拖拽改角、滚轮步进、离散业务应 **snap 到档位**  
- 真实拟态补充：四向 hover 轻微 `rotateX/Y`，激活图标改琥珀色

### 5.2 按钮

| 类型 | 做法 |
|------|------|
| 主操作 | 金属横渐变 + 右投影 + 胶囊 `border-radius: 999px` |
| 危险 | 同结构，偏暖灰红，勿用高饱和扁平红块硬切 |
| 按下 | `scale(0.94~0.98)` 或切换到 inset 阴影（拟态 button2） |
| 迷你方钮 | Gemini：`15px` 圆角 + 细双阴影；或圆形 40px |

### 5.3 输入

- 透明/无框放在 inset 面板内（Gemini chat-input）  
- 或独立 inset 金属槽：`1.5px` rim + 内阴影（Broker 地址）  
- 字色用 `--yz-metal-ink`，placeholder 用 mute

### 5.4 Tab / 分段

- 槽：inset 金属条  
- 滑块/激活页：raised 小胶囊，带左右不对称阴影  
- 导航对比 B 案：未选灰字 `#52616B`，选中实心 `#4a5861` 白字胶囊

### 5.5 卡片 / 面板

- 外：金属渐变或半透明金属 + rim  
- 角：侧栏卡片 `14px–18px`；大壳 `35px–40px`（Gemini）或全圆  
- 状态：角上小灯点（熄灭灰 / 接通白光 / 忙碌琥珀 / 故障浅红光）

### 5.6 灯点

- 尺寸：`6–8px` 圆  
- 灭：`#6a7d83`  
- 亮：`#fff` + 光晕；可 `::after` 再 blur 一层  
- 不要用粗描边彩色 badge 替代「灯点隐喻」（除非告警语义）

---

## 6. 字体与层级

- 演示多用：`微软雅黑` / 系统默认；产品保持现有 system-ui 栈即可  
- 层级建议：  
  - 面板大标题 `~13–14px` / `700–800` / ink  
  - 区标题 `11–12px` / 大写或字距略增 / mute  
  - 正文 `12px` / ink  
  - 辅助 `10–11px` / mute  
- 数字/遥测可略加重字重；避免彩色大字抢金属质感（色相留给传感器语义卡）

---

## 7. 圆角 · 描边 · 布局节奏

| 元素 | 圆角 | 描边 |
|------|------|------|
| 旋钮/圆钮 | `50%` | `1.5px #c6ccca` |
| 胶囊 Tab/主按钮 | `999px` | 可选 rim |
| 中卡片 | `14–18px` | `1.5px` rim |
| 大输入壳 | `35–40px` 外框，内层略小 | 渐变边框 trick |
| 小控件 | `6–16px` | 轻 |

布局节奏：

- 演示：单焦点居中，周围留白大  
- 产品侧栏：同一材质重复出现，**间距 8–12px**，避免一页混「扁平 iOS 蓝块 + 金属旋钮」两套语言  
- 信息密度：灯点/细边表达状态，少用粗色条

---

## 8. 动效

- 默认：`transition: 0.2s` / `0.25s ease-out`  
- 按下缩放：短于 `0.15s`  
- 灯环档位：可较长（参考 2s）但业务 snap 应用短动画避免拖沓  
- `user-select: none` 在纯控件演示中普遍；输入区要放开选区  
- 尊重 `prefers-reduced-motion`：产品落地时应减弱连续动画

---

## 9. 可直接抄的 CSS 变量块

```css
:root {
  /* YZRT metal — 主轴 */
  --yz-metal-hi: #eaefed;
  --yz-metal-mid: #dfe4e1;
  --yz-metal-lo: #bfc9ca;
  --yz-metal-deep: #95a7ae;
  --yz-metal-ink: #2a3a3e;
  --yz-metal-mute: #6a7d83;
  --yz-rim: #c6ccca;
  --yz-glow: #ffffff;
  --yz-accent: #5b8fa3;
  --yz-accent-strong: #3d6f82;

  --yz-bg-wash: linear-gradient(90deg, #d2deda, #c1d0d4);
  --yz-panel-grad: linear-gradient(90deg, var(--yz-metal-mid), var(--yz-metal-lo));
  --yz-face-grad: linear-gradient(90deg, var(--yz-metal-hi), var(--yz-metal-deep));

  --yz-shadow-out:
    -8px 0 14px rgba(255, 255, 255, 0.35),
    4px 0 8px rgba(2, 29, 37, 0.08),
    14px 0 22px rgba(2, 29, 37, 0.28);
  --yz-shadow-in:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.55);

  /* 建议补齐 ↓ */
  --yz-amber: #e3a560;          /* 真实拟态激活/警告暖色 */
  --yz-amber-glow: #f1b475;
  --yz-lamp-off: #6a7d83;
  --yz-lamp-on: #ffffff;
  --yz-radius-pill: 999px;
  --yz-radius-card: 16px;
  --yz-radius-shell: 40px;
  --yz-border-width: 1.5px;
  --yz-ease: 0.2s ease;
  --yz-press-scale: 0.96;

  /* Gemini 冷灰蓝（可选第二主题轴） */
  --yz-cool-bg: #e1e9f1;
  --yz-cool-text: #111b2d;
  --yz-cool-border-dark: #92a8c1;
  --yz-cool-border-light: #fefeff;
}
```

工具类示意：

```css
.yz-raised {
  border: var(--yz-border-width) solid var(--yz-rim);
  background: var(--yz-face-grad);
  box-shadow: var(--yz-shadow-out), var(--yz-shadow-in);
  border-radius: var(--yz-radius-card);
}
.yz-inset {
  border: var(--yz-border-width) solid var(--yz-rim);
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  box-shadow: var(--yz-shadow-in);
  border-radius: var(--yz-radius-card);
}
.yz-lamp {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--yz-lamp-off);
}
.yz-lamp.on {
  background: var(--yz-lamp-on);
  box-shadow: 0 0 5px #fff, 0 0 10px rgba(255,255,255,0.8);
}
```

---

## 10. 与当前环境监测 `--yz-*` 对照（建议补齐）

**已有（大致对齐声音旋钮）**：  
`--yz-metal-hi/mid/lo/deep/ink/mute`、`--yz-rim`、`--yz-glow`、`--yz-accent(-strong)`、`--yz-shadow-out/in`、`--yz-panel-grad`、`--yz-face-grad`

**建议补齐：**

| 缺口 | 为什么要 |
|------|----------|
| `--yz-amber` / `--yz-amber-glow` | 真实拟态激活色；告警/选中暖反馈，避免只用系统蓝 |
| `--yz-lamp-off` / `--yz-lamp-on` | 统一灯点，别散落硬编码 |
| `--yz-bg-wash` | 壳/侧栏背景一处定义 |
| `--yz-radius-pill/card/shell`、`--yz-border-width` | 圆角与描边节奏统一 |
| `--yz-ease`、`--yz-press-scale` | 动效一致 |
| `--yz-cool-*`（可选） | SoftConfig / 大表单壳可走 Gemini 变体而不污染金属主轴 |
| 垂直光影 mixin（真实拟态） | 部分旋钮/按键用「下方投影」与声音旋钮「右侧投影」并存时需文档约定 |

**已知偏差（下一轮 UI 可修）：**

- 仍残留偏 Apple 的高饱和蓝主按钮（`#007aff`）与 YZRT 低饱和青灰抢戏 → 主按钮应吃 `--yz-face-grad`  
- 传感器纯色实底可保留语义色，但外圈必须吃金属投影（已有部分）  
- 避免再引入扁平「iOS 分段」白块而不带 inset 槽  

---

## 11. 反例（不要做成什么样）

1. **整页高饱和渐变炫光**（霓虹、彩虹描边）— 破坏灰青金属克制感  
2. **纯扁平 Material / 只有 1px 灰线无浮雕** — 失去 YZRT 辨识度  
3. **厚重拟态过度**：阴影模糊半径过大导致脏、糊，侧栏小控件尤忌 `>20px` 双轴重影叠太多层  
4. **玻璃 + 金属 + 深色机械三套主语言同屏** — 演示仓库分文件可以，产品一屏只能一条主轴  
5. **用粗彩色 Badge 代替灯点** 表达连接状态  
6. **指示旋钮不可操作却画得像主控件** — 隐喻要匹配交互  
7. **照搬 B 站搜索条扁平灰作为全局** — 那是对比样本，不是主风格  
8. **把 Launch 蓝光扫描铺到所有按钮** — 演出向，不是默认  
9. **改 3D 视口内部光照/模型来「配合 UI」** — 风格纪要只管壳与操作区  
10. **往工程堆 bak / 拷贝整个 yzrt 目录** — 只需 token + 组件级样式  

---

## 12. 落地优先级（给下一轮 UI）

1. **Token 补齐**（amber、lamp、radius、ease）写入 `src/styles.css` `:root`  
2. **设置页 / MQTT**：主次按钮、输入槽、连接卡灯点已部分对齐 → 扫一遍残留 `#007aff`  
3. **环境与设备**：设备控制档位钮、叠层导航圆钮统一 raised；状态条 inset  
4. **软件配置面板**：可试用 `--yz-cool-*` 壳或继续金属主轴，二选一写死  
5. **界面皮肤旋钮**：保持声音旋钮结构，变量改引用 `--yz-*`，避免局部硬编码分叉  
6. 新控件先问：是 **raised / inset / lamp** 哪一种？再写 CSS  

---

## 13. 核心结论（10 条）

1. YZRT 主语言是 **浅灰青金属拟态**，不是彩色扁平，也不是纯深色赛博。  
2. **多层同心 + 1.5px rim + 不对称投影（常偏右侧）** 是旋钮/圆钮的标准腔体。  
3. **灯点与指示条** 是状态与档位的主反馈，优先于文字徽章。  
4. 控件成对出现：**外凸可点 / 内凹承载**（槽、输入、嵌板）。  
5. 色相克制：主界面青灰；**琥珀仅作激活/温馨强调**；语义色（温湿气）可局部保留。  
6. 圆角两极：`50%` 圆器件 ↔ `999px` 胶囊 ↔ `14–18px` 卡片。  
7. 动效短、按压缩放；长动画只给「扫过感」的灯环。  
8. Gemini 冷灰蓝、Launch 深色蓝光、液态玻璃都是 **变体**，默认侧栏跟声音旋钮走。  
9. 产品落地要 **token 化**；当前 `--yz-*` 已覆盖金属主轴，需补 amber/lamp/radius/ease/cool。  
10. 反例底线：不整仓拷贝、不堆 bak、不动 3D 核心、不同屏混三套材质主轴。  

---

*本文档只读归纳自 yzrt 演示源码；修改 yzrt 原文件不在任务范围内。*
