# 奶家人孪生屏 ↔ F411 硬件 MyUI 同步说明

## 对齐真源
- 硬件：`D:\xxzz\1 (1)\1` / `env-screen-f411-cubemx` MyUI V2
- 桌面：`src/three/screenTheme.js` + `ThreeEngine.drawScreen`

## 布局 diff（旧桌面 F103 风格 → F411 V2）
| 区域 | 旧孪生（F103） | 现孪生（F411） |
|------|----------------|----------------|
| 状态栏 | 时/日/WiFi/电量 | 同（坐标跟 F411 BAR） |
| 左栏 | 三行图标：温/湿/AQI | 大温度 + 天气行 + 湿度行 |
| 右栏 | 呼吸灯/蜂鸣/风扇开关 | 空气质量大数字 + 等级 + 24 段刻度 |
| 开关 | 可点 breath/fan/buzzer | **无命中**（跟硬件一致） |
| 皮肤 | 桌面 4 套预览 | 仍可换色板；硬件无皮肤页 |

## 上行 JSON（USART2 → ESP → MQTT `device/stm32/sensor_data`）
最少：`temp,humidity,aqi,wifi`  
可选：`battery,weatherCond,weatherLow,weatherHigh,hour,minute,month,day`

## 手测
1. 桌面：`npm run dev`，开 `node scripts/mock-stm32.mjs`，看孪生屏大温度/天气/湿度/空气质量是否刷新。
2. 真机：烧录 F411 Cube 工程 + 烧 ESP `esp8266/mqtt_bridge.ino`，Broker 与桌面一致，串口应见 JSON 行。
