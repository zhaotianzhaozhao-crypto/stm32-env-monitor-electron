/**
 * MyUI_config.h - 环境监测界面配置（布局坐标 / 样式 / 阈值 / 颜色）
 * MyUI.c 中所有数值参数集中在此定义，调整界面只改这个文件
 */
#ifndef __MYUI_CONFIG_H
#define __MYUI_CONFIG_H

#include "lvgl.h"

/*==================== 屏幕 ====================*/
#define MYUI_SCREEN_W                  320
#define MYUI_SCREEN_H                  240

/*==================== 状态栏 ====================*/
#define MYUI_BAR_X                     0
#define MYUI_BAR_Y                     0
#define MYUI_BAR_W                     MYUI_SCREEN_W
#define MYUI_BAR_H                     32
#define MYUI_BAR_RADIUS                0
#define MYUI_TIME_X                    8
#define MYUI_TIME_Y                    1
#define MYUI_DATE_X                    86
#define MYUI_DATE_Y                    8
#define MYUI_BATT_OFFSET_X             (-8)     /* 电池标签右对齐时的水平偏移 */

/* WiFi 信号条：4 根从矮到高，点亮数量 = 信号强度 */
#define MYUI_WIFI_LEVEL_MAX            4        /* 信号强度档数(0~4) */
#define MYUI_WIFI_BAR_W                4        /* 单根信号条宽度 */
#define MYUI_WIFI_BAR_GAP              6        /* 根与根间距 */
#define MYUI_WIFI_BAR_X                224      /* 第一根 X 坐标 */
#define MYUI_WIFI_BAR_BOTTOM_Y         25       /* 各根底边对齐的 Y 坐标 */
#define MYUI_WIFI_BAR_RADIUS           1
#define MYUI_WIFI_BAR_H1               5        /* 第 1 根高度(最矮) */
#define MYUI_WIFI_BAR_H2               8
#define MYUI_WIFI_BAR_H3               11
#define MYUI_WIFI_BAR_H4               14       /* 第 4 根高度(最高) */

/*==================== 小熊(状态栏装饰) ====================*/
#define MYUI_BEAR_X                    161      /* 状态栏内位置(日期与 WiFi 信号条之间的空档) */
#define MYUI_BEAR_Y                    2        /* 基础 y(上下各留 2px 浮动空间) */
#define MYUI_BEAR_FRAMES               10       /* 摇摆动画帧数(一个循环) */
#define MYUI_BEAR_FRAME_MS             160      /* 每帧时长(ms) */
/* 摇摆关键帧(每帧一组): 上下浮动偏移(像素) + 摆动角度(0.1度单位) */
#define MYUI_BEAR_BOB_TABLE            { 0, -1, -2, -2, -1, 0, 1, 2, 2, 1 }
#define MYUI_BEAR_ANGLE_TABLE          { 30, 50, 50, 30, 0, -30, -50, -50, -30, 0 }

/*==================== 开屏动画(全黑 -> 校徽淡入 -> 停留 -> 界面淡入) ====================*/
#define MYUI_SPLASH_TICK_MS        50    /* 动画步进周期(ms)，可整除各阶段时长 */
#define MYUI_SPLASH_BLACK_MS       200   /* 全黑停留时长(ms) */
#define MYUI_SPLASH_BG_FADE_MS     1000  /* 校徽背景淡入时长(ms) */
#define MYUI_SPLASH_HOLD_MS        500   /* 背景停留时长(ms) */
#define MYUI_SPLASH_UI_FADE_MS     800   /* 界面元素淡入时长(ms) */

/*==================== 卡片(左右共用) ====================*/
#define MYUI_CARD_Y                    36
#define MYUI_CARD_H                    200
#define MYUI_CARD_RADIUS               10
#define MYUI_CARD_BORDER_W             1        /* 卡片描边宽度(1 像素) */
#define MYUI_DIVIDER_H                 1        /* 分隔线高度(1 像素) */

/*==================== 左卡片：温度 / 湿度 / 天气 ====================*/
#define MYUI_CARD_L_X                  4
#define MYUI_CARD_L_W                  204
#define MYUI_DIV_X                     14       /* 分隔线(相对卡片) */
#define MYUI_DIV_W                     176
#define MYUI_DIV1_Y                    66
#define MYUI_DIV2_Y                    133
/* 温度行(卡片内中心线 y=33) */
#define MYUI_ICON_TEMP_X               16
#define MYUI_ICON_TEMP_Y               21
#define MYUI_LBL_TEMP_X                56
#define MYUI_LBL_TEMP_Y                16
/* 湿度行(卡片内中心线 y=100) */
#define MYUI_ICON_HUMI_X               19
#define MYUI_ICON_HUMI_Y               88
#define MYUI_LBL_HUMI_X                56
#define MYUI_LBL_HUMI_Y                83
/* 天气行(卡片内中心线 y=167) */
#define MYUI_ICON_WEATHER_X            13
#define MYUI_ICON_WEATHER_Y            155
#define MYUI_LBL_WEATHER_X             56
#define MYUI_LBL_WEATHER_Y             150

/*==================== 右卡片：呼吸灯 / 小风扇开关 ====================*/
#define MYUI_CARD_R_X                  212
#define MYUI_CARD_R_W                  104
#define MYUI_SW_DIV_X                  10       /* 分隔线(相对右卡片) */
#define MYUI_SW_DIV_Y                  99
#define MYUI_SW_DIV_W                  84
/* 呼吸灯(图标中心线 y=68, 开关中心线 y=101) */
#define MYUI_ICON_BREATH_X             40
#define MYUI_ICON_BREATH_Y             19
#define MYUI_SW_BREATH_X               26
#define MYUI_SW_BREATH_Y               51
/* 小风扇(图标中心线 y=170, 开关中心线 y=203) */
#define MYUI_ICON_FAN_X                40
#define MYUI_ICON_FAN_Y                121
#define MYUI_SW_FAN_X                  26
#define MYUI_SW_FAN_Y                  153

/*==================== 样式与动画 ====================*/
#define MYUI_SW_W                      50       /* 开关宽度 */
#define MYUI_SW_H                      26       /* 开关高度 */
#define MYUI_ICON_OPA_OFF              LV_OPA_40  /* 开关关闭时图标透明度 */
#define MYUI_FAN_ROTATE_PERIOD_MS      100      /* 风扇转动动画刷新周期(ms) */
#define MYUI_FAN_ANGLE_STEP            300      /* 每周期转动角度(0.1度单位, 即30度) */
#define MYUI_FAN_ANGLE_WRAP            3600     /* 角度回绕值(0.1度单位, 即360度) */

/*==================== 颜色 ====================*/
#define MYUI_COLOR_SCREEN_BG           lv_color_hex(0x000000)
#define MYUI_COLOR_TEMP                lv_color_hex(0xFFD96A)   /* 温度 金黄 */
#define MYUI_COLOR_HUMI                lv_color_hex(0xBBEBF6)   /* 湿度 淡蓝 */
#define MYUI_COLOR_WEATHER             lv_color_hex(0xCFF2D6)   /* 天气 淡绿 */
#define MYUI_COLOR_TEXT                lv_color_hex(0xF2F5F7)   /* 状态栏主文字 */
#define MYUI_COLOR_TEXT_DIM            lv_color_hex(0xC8D0D6)   /* 状态栏次要文字 */
#define MYUI_COLOR_ACCENT              lv_color_hex(0x38D39F)   /* 开关打开时的颜色 */
#define MYUI_COLOR_WIFI_ON             lv_color_hex(0x8FE3C2)   /* WiFi 信号条点亮 */
#define MYUI_COLOR_WIFI_OFF            lv_color_hex(0x5A636B)   /* WiFi 信号条熄灭 */
#define MYUI_COLOR_SW_TRACK            lv_color_hex(0x39424B)   /* 开关滑轨底色 */

/*==================== 数据范围与阈值 ====================*/
#define MYUI_HOUR_MIN                  0
#define MYUI_HOUR_MAX                  23
#define MYUI_MINUTE_MIN                0
#define MYUI_MINUTE_MAX                59
#define MYUI_MONTH_MIN                 1
#define MYUI_MONTH_MAX                 12
#define MYUI_DAY_MIN                   1
#define MYUI_DAY_MAX                   31
#define MYUI_HUMI_MIN                  0
#define MYUI_HUMI_MAX                  100
#define MYUI_TEMP_MIN                  (-50.0f)    /* 温度下限(°C) */
#define MYUI_TEMP_MAX                  (150.0f)    /* 温度上限(°C) */
#define MYUI_TEMP_MIN_I                (-50)       /* 温度下限(整数, 用于天气范围校验) */
#define MYUI_TEMP_MAX_I                150         /* 温度上限(整数) */
#define MYUI_TEMP_DEC_SCALE            10          /* 温度小数位换算(1位小数 × 10) */
#define MYUI_BATT_MIN                  0
#define MYUI_BATT_MAX                  100
#define MYUI_BATT_TH_FULL              95          /* 满格电池图标阈值 */
#define MYUI_BATT_TH_3                 70
#define MYUI_BATT_TH_2                 45
#define MYUI_BATT_TH_1                 20

#endif
