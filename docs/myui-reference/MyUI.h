/**
 * MyUI.h - 环境监测界面 V2（状态栏 + 双栏卡片）
 * 屏幕：320x240 横屏，保留校徽底板
 *
 * 中文标签（10月15日 周三 / 晴 等）等字库补充好后再加
 */
#ifndef __MYUI_H
#define __MYUI_H

#include "lvgl.h"
#include "MyUI_config.h"

/* 错误码：0-成功，负值-失败 */
typedef enum
{
    MYUI_OK = 0,               /* 成功 */
    MYUI_ERR_NOT_INIT = -1,    /* 界面未初始化(myui_init 未调用或 LVGL 未初始化) */
    MYUI_ERR_PARAM = -2,       /* 参数超出允许范围 */
    MYUI_ERR_STATE = -3        /* 状态错误(如重复初始化) */
} myui_err_t;

/* 天气类型（决定天气图标） */
typedef enum
{
    MYUI_WEATHER_SUNNY = 0,    /* 晴 */
    MYUI_WEATHER_CLOUDY,       /* 多云 */
    MYUI_WEATHER_OVERCAST,     /* 阴 */
    MYUI_WEATHER_RAINY         /* 雨 */
} myui_weather_t;

/* 控件句柄与运行状态（实例为 MyUI.c 内静态变量，外部请勿直接访问） */
typedef struct
{
    lv_obj_t   *lbl_time;                       /* 时间标签 */
    lv_obj_t   *lbl_date;                       /* 日期标签 */
    lv_obj_t   *lbl_batt;                       /* 电池标签 */
    lv_obj_t   *wifi_bar[MYUI_WIFI_LEVEL_MAX];  /* WiFi 信号条(从矮到高) */
    lv_obj_t   *lbl_temp;                       /* 温度标签 */
    lv_obj_t   *lbl_humi;                       /* 湿度标签 */
    lv_obj_t   *img_weather;                    /* 天气/AQI 图标 */
    lv_obj_t   *lbl_weather;                    /* AQI 标签 */
    lv_obj_t   *img_breath;                     /* 呼吸灯图标 */
    lv_obj_t   *img_fan;                        /* 小风扇图标 */
    lv_obj_t   *img_bear;                       /* 小熊图标(状态栏装饰) */
    lv_obj_t   *img_bg;                         /* 背景底板图 */
    lv_obj_t   *img_temp;                       /* 温度图标 */
    lv_obj_t   *img_humi;                       /* 湿度图标 */
    lv_obj_t   *obj_bar;                        /* 状态栏面板 */
    lv_obj_t   *obj_card_l;                     /* 左卡片面板 */
    lv_obj_t   *obj_card_r;                     /* 右卡片面板 */
    lv_obj_t   *div_l1;                         /* 左卡片分隔线1 */
    lv_obj_t   *div_l2;                         /* 左卡片分隔线2 */
    lv_obj_t   *div_sw;                         /* 右卡片分隔线 */
    lv_obj_t   *sw_breath;                      /* 呼吸灯开关 */
    lv_obj_t   *sw_fan;                         /* 小风扇开关 */
    lv_timer_t *fan_timer;                      /* 风扇转动定时器(未转时为 NULL) */
    lv_timer_t *bear_timer;                     /* 小熊摇摆定时器 */
    lv_timer_t *splash_timer;                   /* 开屏动画定时器(完成后为 NULL) */
    int16_t     fan_angle;                      /* 风扇当前角度(0.1度单位) */
    uint8_t     bear_frame;                     /* 小熊摇摆动画当前帧 */
    uint8_t     splash_state;                   /* 开屏动画状态 */
    int16_t     splash_tick;                    /* 开屏动画计时(步数) */
} myui_ctx_t;

/* 创建界面，开机调用一次（需在 lv_init/lv_port_disp_init 之后） */
int myui_init(void);

/* --- 数据更新接口（必须先 myui_init，返回值 0-成功 / 负值-失败） --- */
int myui_set_time(int hour, int minute);                       /* 时间 14:32 */
int myui_set_date(int month, int day);                         /* 日期 10/15 */
int myui_set_env_data(float temp, int humi);                   /* 温度(°C)/湿度(%) */
int myui_set_aqi(int aqi);                                     /* 空气质量 AQI(0~300) */
int myui_set_battery(int percent);                             /* 电池电量 0~100 */
int myui_set_wifi(int level);                                  /* WiFi 强度 0~4 */

#endif
