# shared/defaults.json 字段说明

> JSON 不允许注释，本文件为维护旁注。改协议时同步：`electron/config.cjs`、`src/config.js`、固件、本说明。

| 字段 | 含义 | 改时注意 |
|------|------|----------|
| `productName` / `productId` / `version` | 产品名与版本 | 升版改 `package.json` + 本文件 + CHANGELOG；注释任务勿擅自升版 |
| `mode` | `demo` \| `production` | 可被环境变量 `NAIJIAREN_MODE` 覆盖；生产强制 TLS |
| `broker.demoUrl` | 演示默认 Broker | 仅 demo；生产由配置锁定 |
| `broker.allowedHosts` | 主机白名单 | `validateBrokerUrl` 硬校验，漏写则连不上 |
| `broker.requireTlsInProduction` | 生产是否必须 mqtts/wss | 保持 true |
| `broker.allowedSchemesDemo` / `Production` | 允许协议 | demo 可 mqtt；prod 仅 mqtts/wss |
| `topics.sensor` | 上行传感器主题 | 与 ESP/固件 publish 一致 |
| `topics.command` | 下行指令主题 | 主进程 publish，正文末尾加 `\n` |
| `allowedCommands` | **MQTT 指令白名单** | 含 `buzzer:*` / `breath:*` / `fan:*` / `skin:*`；`breath:bri`/`breath:color` **故意不在此**（HC-05 前仅孪生） |
| `dataTimeoutMs` | 无数据判离线毫秒 | 默认 8000；`useDeviceHealth` 使用 |
| `thresholds.*` | 默认报警阈值 | 用户改动后存 localStorage，覆盖默认 |
| `skins[]` | 屏显皮肤列表 | `id` 必须与 `SCREEN_SKINS`、`skin:<id>` 白名单一致 |
| `scenes[]` | 3D 场景 | 现仅 `kind:glb` 加载 `file`；旧 `kind:home` / `__home_editor__` 已移除（引擎会落到 `model.glb`） |
| `auth.demoUsers` | 演示账号 | 仅演示；生产须替换鉴权，勿提交真实密码到公网仓库 |

## 相关代码

- 主进程加载与校验：`electron/config.cjs`
- 渲染进程镜像：`src/config.js`
- 下发拦截：`electron/mqtt-manager.cjs` → `isAllowedCommand`
