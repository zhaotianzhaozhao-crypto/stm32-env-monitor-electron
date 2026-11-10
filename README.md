# 基于 STM32 的环境监测 Electron 上位机

Windows 桌面上位机，用于接收并展示 STM32 环境监测节点的数据，并可下发控制指令。

- 课题 / 仓库名：**基于 STM32 的环境监测 Electron 上位机**
- 桌面产品名：奶家人（Naijiaren）
- 当前版本：v1.3.10
- 技术栈：Electron + Vue 3 + Three.js + MQTT

硬件侧由 STM32 采集温度、湿度、空气质量（AQI）等数据，经 ESP8266 上报到 MQTT Broker；本仓库是对应的桌面端，负责实时监视、报警、历史曲线、数字孪生屏显，以及蜂鸣器 / 风扇 / 呼吸灯 / 皮肤等下行控制。

更完整的架构、目录和改文件指引见 [`docs/工程说明.md`](docs/工程说明.md)。版本记录见 [`CHANGELOG-奶家人.md`](CHANGELOG-奶家人.md)。

## 主要功能

- 实时监测温度、湿度、AQI，超时无数据会反映为离线
- 阈值报警与历史趋势（ECharts），支持导出 Excel
- 数字孪生 3D 视口：加载 `public/model.glb`，屏显纹理与硬件 LVGL MyUI 风格对齐（参考 `docs/myui-reference/`）
- 下行指令白名单：`buzzer` / `breath` / `fan` / `skin:*`；Broker 主机与协议同样有白名单
- 设备管理、工作区间、自动控制（如自动风扇）
- operator / admin 登录；Windows NSIS 安装包（可选安装路径与许可协议）

## 通信协议（与 STM32 固件冻结，勿随意改）

| 方向 | MQTT 主题 | 载荷 |
|------|-----------|------|
| 上行 | `device/stm32/sensor_data` | JSON：`temp` / `humidity` / `aqi` / `btn`（`CW`/`CCW`）；可选 `breath` / `fan` / `buzzer` / `battery` / `wifi` |
| 下行 | `device/stm32/commands` | `buzzer:*` / `breath:*` / `fan:*` / `skin:*`，末尾带 `\n`（breath / fan 若固件未接则无效） |

单一配置源：`shared/defaults.json`（前端 `src/config.js` 与主进程 `electron/config.cjs` 共用）。

数据路径简述：

```
STM32 → ESP8266 → MQTT device/stm32/sensor_data
  → Electron 主进程 → IPC → Vue 界面 / 报警 / 3D 屏显 / 历史曲线

界面操作 → 指令白名单校验 → MQTT device/stm32/commands → 硬件
```

## 开发运行

```bash
npm install
npm run dev            # Vite + Electron 开发
npm run build          # 仅前端打包
npm run dist           # Windows NSIS 安装包 → release/
npm run mock:broker    # 本地 MQTT Broker，便于无硬件联调
npm run mock:stm32     # 模拟 STM32 上报
```

环境变量：

- `NAIJIAREN_MODE=demo|production` — 生产模式强制 mqtts/wss，并校验 Broker 主机白名单

演示账号（仅开发 / 演示，部署时请替换）：

- `operator` / `naijia2026`
- `admin` / `admin2026`

## 目录结构

```
├── shared/defaults.json     # 配置真源（Broker、主题、阈值、皮肤）
├── electron/                # 主进程：窗口、IPC、MQTT 与白名单
├── src/                     # Vue 界面、业务组合式函数、Three.js 引擎
├── public/model.glb         # 数字孪生模型
├── build/icon.ico           # Windows 图标
├── installer/               # NSIS 许可与安装钩子
├── scripts/                 # 本地 MQTT / STM32 模拟联调
├── docs/工程说明.md         # 本工程的详细说明
└── CHANGELOG-奶家人.md
```

`node_modules/`、`dist/`、`release/` 等构建产物已写入 `.gitignore`，不会进入仓库。

## 已知限制

- 代码签名与自动更新尚未接入
- 生产环境的 MQTT 账号 / 证书需在部署时写入配置
- 更换 3D 场景时，需把新的 GLB 放到 `public/`，并在 `shared/defaults.json` 的 `scenes` 中注册
