# 硬件屏 LVGL 多风格（参考，勿覆盖 Drive dht11 原件）

桌面端「界面皮肤」切换的是 **ILI9341 上的 LVGL 风格 id**，不是整窗主题。
软件孪生屏用 Canvas 预览同一套 id；真机需固件解析 MQTT `device/stm32/commands` 上的 `skin:<id>\n`。

## 皮肤 id（与软件一致）

| id | 中文 | 要点 |
|----|------|------|
| `industrial-dark` | 工业深色 | 黑底 + 半透明双卡（默认） |
| `mist-blue` | 雾蓝静谧 | 雾蓝深色底，柔和冷色高亮（原 `minimal-light` 升级；旧 id 查表映射到本项） |
| `soft-home` | 柔和家居 | 暖中性色，成熟家用（非卡通） |
| `ops-cyan` | 运维青金 | 青/金监控，AQI≥100 加强描边 |

信息架构不变：状态栏（时间/日期/WiFi/电池）+ 左环境卡（温/湿/AQI）+ 右开关卡（呼吸灯/风扇）。**不要校徽底板。**

色板头文件见同目录 `MyUI_skins.h`（含 RGB888 十六进制与 `myui_find_skin()`；兼容旧 payload `skin:minimal-light`）。

## 去校徽（补丁说明）

参考副本：`docs/myui-reference/MyUI.c`（**请勿写回** Google Drive `dht11` 原工程）。

任选其一：

1. 创建后保持透明（推荐，保留对象以免改布局）：
   ```c
   lv_obj_set_style_img_opa(s_myui.img_bg, LV_OPA_TRANSP, 0);
   ```
2. 跳过 `myui_create_bg(parent);`，屏底用纯色：
   ```c
   lv_obj_set_style_bg_color(lv_scr_act(), lv_color_black(), 0);
   lv_obj_set_style_bg_opa(lv_scr_act(), LV_OPA_COVER, 0);
   ```
3. 开屏动画：去掉 `MYUI_SPLASH_BG`（校徽淡入）阶段，直接进入界面淡入。

## MQTT 换肤

- Topic：`device/stm32/commands`（与蜂鸣器相同）
- Payload：`skin:industrial-dark\n` / `skin:mist-blue\n` / `skin:soft-home\n` / `skin:ops-cyan\n`
- 旧指令 `skin:minimal-light\n` 固件侧应映射为 `mist-blue`
- 桌面白名单已加入上述四条；**当前量产固件若未解析 `skin:`，指令会被忽略，仅软件孪生预览生效。**

固件侧建议：

```c
/* 伪代码 */
if (strncmp(line, "skin:", 5) == 0) {
    const myui_skin_palette_t *p = myui_find_skin(line + 5);
    myui_apply_skin(p); /* 查表改 COLOR_* 并 lv_obj_set_style_* */
}
```

## 与软件对齐

- 软件：`ThreeEngine.setScreenSkin(id)` + `shared/defaults.json` → `skins` + `src/three/screenTheme.js`
- 持久化：`localStorage['naijiaren.screenSkin']`
