# MyUI 参考（dht11 硬件 LVGL）

来自 Google Drive `dht11` 的界面源码**只读副本**，用于桌面端 `ThreeEngine.drawScreen` 布局对齐。

| 文件 | 用途 |
|------|------|
| `MyUI_config.h` | 布局坐标与颜色（权威） |
| `MyUI.c` / `MyUI.h` | LVGL 控件创建与数据格式 |
| `MyUI_bg.c` | 320×240 RGB565 校徽底板（**桌面端已停用**） |
| `MyUI_icons*.h` | 温度/湿度/云/呼吸灯/风扇/小熊图标（RGB565+A） |

提取产物在 `public/myui/`（功能图标仍用；`bg.png` / `bg@2x.png` 已删除，孪生屏用纯色底板）。

## 去校徽 / 多风格

见 [`../firmware-skins/README.md`](../firmware-skins/README.md)。  
**不要**把修改后的 MyUI 上传回 Drive `dht11` 原文件夹；在独立固件分支中应用。
