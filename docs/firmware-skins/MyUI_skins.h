/**
 * MyUI_skins.h — 硬件屏 LVGL 多风格色板（与桌面 screenTheme.js SCREEN_SKINS 对齐）
 * 仅文档/固件分支使用，不直接覆盖 Drive dht11 原工程。
 */
#ifndef MYUI_SKINS_H
#define MYUI_SKINS_H

#include "lvgl.h"
#include <string.h>

typedef enum {
    MYUI_SKIN_INDUSTRIAL_DARK = 0,
    MYUI_SKIN_MIST_BLUE,
    MYUI_SKIN_SOFT_HOME,
    MYUI_SKIN_OPS_CYAN,
    MYUI_SKIN_COUNT
} myui_skin_id_t;

typedef struct {
    myui_skin_id_t id;
    const char    *mqtt_id;       /* "industrial-dark" 等 */
    uint32_t       screen_bg_hex;
    uint32_t       card_bg_hex;
    uint32_t       text_hex;
    uint32_t       text_dim_hex;
    uint32_t       temp_hex;
    uint32_t       humi_hex;
    uint32_t       weather_hex;
    uint32_t       accent_hex;
    uint32_t       wifi_on_hex;
    uint32_t       wifi_off_hex;
    uint32_t       sw_track_hex;
    lv_opa_t       card_opa;      /* 卡片背景不透明度 */
    uint8_t        card_radius;
    uint8_t        aqi_emphasis;  /* 非 0：AQI >= 100 告警强调 */
} myui_skin_palette_t;

static inline const myui_skin_palette_t *myui_skin_table(void)
{
    static const myui_skin_palette_t table[MYUI_SKIN_COUNT] = {
        /* 1. 工业深色 (industrial-dark) */
        {
            MYUI_SKIN_INDUSTRIAL_DARK, "industrial-dark",
            0x000000, 0x000000, 0xF2F5F7, 0xC8D0D6,
            0xFFD96A, 0xBBEBF6, 0xCFF2D6, 0x38D39F,
            0x8FE3C2, 0x5A636B, 0x39424B,
            LV_OPA_50, 10, 0
        },
        /* 2. 雾蓝静谧 (mist-blue) */
        {
            MYUI_SKIN_MIST_BLUE, "mist-blue",
            0x0E1624, 0x16243A, 0xE8F1FF, 0x94A3B8,
            0x7DD3FC, 0x93C5FD, 0xA5B4FC, 0x38BDF8,
            0x7DD3FC, 0x334155, 0x1E293B,
            LV_OPA_80, 14, 0
        },
        /* 3. 柔和家居 (soft-home) */
        {
            MYUI_SKIN_SOFT_HOME, "soft-home",
            0x2A2420, 0x3A322C, 0xF5F0E8, 0xC9BDB0,
            0xE8B86D, 0xA8C5C0, 0xC4B5A0, 0xC4A574,
            0xD4B896, 0x5C534C, 0x4A433C,
            LV_OPA_80, 14, 0
        },
        /* 4. 运维青金 (ops-cyan) */
        {
            MYUI_SKIN_OPS_CYAN, "ops-cyan",
            0x050B10, 0x081820, 0xE8FFFB, 0x94A3B8,
            0xD4A84B, 0x5EEAD4, 0x2DD4BF, 0x0EA5A0,
            0x2DD4BF, 0x334155, 0x1E293B,
            LV_OPA_90, 8, 1
        },
    };
    return table;
}

/**
 * 根据 MQTT 下发的皮肤名称查找色板（兼容旧版 minimal-light 自动映射到 mist-blue）
 */
static inline const myui_skin_palette_t *myui_find_skin(const char *mqtt_id)
{
    const myui_skin_palette_t *table = myui_skin_table();
    int i = 0;

    if (mqtt_id == NULL) {
        return &table[0];
    }
    if (strncmp(mqtt_id, "minimal-light", 13) == 0) {
        return &table[MYUI_SKIN_MIST_BLUE];
    }
    for (i = 0; i < MYUI_SKIN_COUNT; i++) {
        if (strncmp(mqtt_id, table[i].mqtt_id, strlen(table[i].mqtt_id)) == 0) {
            return &table[i];
        }
    }
    return &table[0];
}

#endif /* MYUI_SKINS_H */