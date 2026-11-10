# 云电脑联调笔记（1.3.10 · 智能家居中控）

> 本机无 mosquitto / docker；用 Node `aedes` 作本地 Broker。版本保持 **1.3.10**。

## 环境

- Node v20（box）
- 工程：`/workspace/naijiaren`
- 主题：`device/stm32/sensor_data`（上行）/ `device/stm32/commands`（下行，须尾 `\n`）

## 命令（已跑通）

```bash
cd /workspace/naijiaren

# 1) 前端构建
npm run build
# → PASS（vite + electron main 均成功）

# 2) 本地 Broker（aedes v1：Aedes.createBroker）
npm run mock:broker
# 或: node scripts/mock-broker.mjs
# → [mock-broker] aedes listening on mqtt://127.0.0.1:1883

# 3) 另开终端：模拟 STM32（订命令 / 报传感）
npm run mock:stm32
# → subscribed device/stm32/commands
# → 周期性 SENSOR JSON；收到指令打印 CMD ← …

# 4) 指令往返冒烟（fan:on\n）
npm run mock:roundtrip
# → PASS: received fan:on with trailing newline
# mock-stm32 同步看到: CMD ← … "fan:on\n"
```

## 结果摘要

| 项 | 结果 |
|---|---|
| `npm run build` | PASS |
| aedes broker :1883 | PASS |
| mock-stm32 订命令 + 报传感 | PASS |
| `mqtt-roundtrip` `fan:on\n` | PASS |
| 额外 `buzzer:off` / `breath:on` 下发 | mock-stm32 均收到 |

## 应用侧联调提示

演示模式允许 `mqtt://127.0.0.1:1883` / `localhost`（已在 `shared/defaults.json` `broker.allowedHosts`）。

1. 起 `mock:broker` + `mock:stm32`
2. 打开应用「设置」→ Broker 填 `mqtt://127.0.0.1:1883` → 接入云端
3. 「环境与设备」→ 中控：手动开关 / 场景一键 / 切自动（高温≥阈值上限自动 `fan:on`）

Electron GUI 烟测依赖显示环境；本笔记以 build + broker/mock 往返为准。

## 脚本清单

- `scripts/mock-broker.mjs`
- `scripts/mock-stm32.mjs`
- `scripts/mqtt-roundtrip.mjs`
