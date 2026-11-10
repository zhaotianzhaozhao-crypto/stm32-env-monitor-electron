/**
 * MyUI.c - 环境监测界面 V2（状态栏 + 双栏卡片）
 * 屏幕：320x240 横屏，保留校徽底板（MyUI_bg.c）
 *
 * 布局（坐标以屏幕左上角为原点，具体数值见 MyUI_config.h）：
 *   状态栏   时间 | 日期 | 小熊装饰 | WiFi信号条 | 电池
 *   左卡片   温度 / 湿度 / 天气（图标 + 数值）
 *   右卡片   呼吸灯开关 / 小风扇开关（图标 + 触摸开关）
 *
 * 中文标签（10月15日 周三 / 晴 等）等字库补充好后再加
 */
#include "MyUI.h"
#include "MyUI_config.h"
#include "MyUI_bg.h"
#include "MyUI_icons.h"
#include "MyUI_icons_data.h"
#include <stdio.h>

/*==================== 模块内部状态 ====================*/
/* 静态存储区变量，上电由 C 运行时清零，控件句柄在 myui_init 中赋值 */
static myui_ctx_t s_myui;

/*==================== 创建卡片/分隔线/开关（静态工具函数） ====================*/
/**
 * 功能: 创建半透明圆角卡片/面板（底板从卡片后面透出）
 * 参数:
 *     parent - 父对象(屏幕或卡片)
 *     x - 卡片左上角 X 坐标
 *     y - 卡片左上角 Y 坐标
 *     w - 卡片宽度
 *     h - 卡片高度
 *     radius - 圆角半径
 * 返回值: 卡片对象指针
 */
static lv_obj_t *myui_create_card(lv_obj_t *parent, lv_coord_t x, lv_coord_t y,
                                  lv_coord_t w, lv_coord_t h, lv_coord_t radius)
{
    lv_obj_t *card = lv_obj_create(parent);

    lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_pos(card, x, y);
    lv_obj_set_size(card, w, h);
    lv_obj_set_style_bg_color(card, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(card, LV_OPA_50, 0);
    lv_obj_set_style_radius(card, radius, 0);
    lv_obj_set_style_border_width(card, MYUI_CARD_BORDER_W, 0);
    lv_obj_set_style_border_color(card, lv_color_white(), 0);
    lv_obj_set_style_border_opa(card, LV_OPA_10, 0);
    lv_obj_set_style_pad_all(card, 0, 0);

    return card;
}

/**
 * 功能: 在卡片内创建 1 像素分隔线
 * 参数:
 *     parent - 父对象(卡片)
 *     x - 分隔线 X 坐标(相对父对象)
 *     y - 分隔线 Y 坐标(相对父对象)
 *     w - 分隔线宽度
 * 返回值: 分隔线对象指针
 */
static lv_obj_t *myui_create_divider(lv_obj_t *parent, lv_coord_t x, lv_coord_t y,
                                     lv_coord_t w)
{
    lv_obj_t *line = NULL;

    line = lv_obj_create(parent);
    lv_obj_clear_flag(line, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_pos(line, x, y);
    lv_obj_set_size(line, w, MYUI_DIVIDER_H);
    lv_obj_set_style_bg_color(line, lv_color_white(), 0);
    lv_obj_set_style_bg_opa(line, LV_OPA_20, 0);
    lv_obj_set_style_border_width(line, 0, 0);
    lv_obj_set_style_radius(line, 0, 0);
    lv_obj_set_style_pad_all(line, 0, 0);

    return line;
}

/**
 * 功能: 设置开关统一样式(尺寸/滑轨色/打开指示色/旋钮色)
 * 参数:
 *     sw - 开关对象
 * 返回值: 无
 */
static void myui_style_switch(lv_obj_t *sw)
{
    lv_obj_set_size(sw, MYUI_SW_W, MYUI_SW_H);
    lv_obj_set_style_bg_color(sw, MYUI_COLOR_SW_TRACK, LV_PART_MAIN);
    lv_obj_set_style_border_width(sw, 0, LV_PART_MAIN);
    lv_obj_set_style_bg_color(sw, MYUI_COLOR_ACCENT, LV_PART_INDICATOR);
    lv_obj_set_style_bg_color(sw, lv_color_white(), LV_PART_KNOB);
}

/*==================== 开关事件回调 ====================*/
/**
 * 功能: 呼吸灯开关事件回调（打开时图标亮起，关闭时变暗）
 * 参数:
 *     e - LVGL 事件对象，携带触发的开关控件
 * 返回值: 无
 */
static void myui_breath_switch_cb(lv_event_t *e)
{
    lv_obj_t *sw = lv_event_get_target(e);
    bool on = lv_obj_has_state(sw, LV_STATE_CHECKED);

    lv_obj_set_style_img_opa(s_myui.img_breath,
                             on ? LV_OPA_COVER : MYUI_ICON_OPA_OFF, 0);

    printf("BreathLight: %s\r\n", on ? "ON" : "OFF");
    /* TODO: 在这里加呼吸灯的硬件控制代码（GPIO / PWM） */
}

/**
 * 功能: 小风扇转动动画定时器回调（每个周期转 MYUI_FAN_ANGLE_STEP）
 * 参数:
 *     timer - LVGL 定时器对象(回调签名需要，本函数未使用)
 * 返回值: 无
 */
static void myui_fan_rotate_cb(lv_timer_t *timer)
{
    LV_UNUSED(timer);

    s_myui.fan_angle = (s_myui.fan_angle + MYUI_FAN_ANGLE_STEP) % MYUI_FAN_ANGLE_WRAP;
    lv_img_set_angle(s_myui.img_fan, s_myui.fan_angle);
}

/**
 * 功能: 小风扇开关事件回调（开关打开时启停转动动画）
 * 参数:
 *     e - LVGL 事件对象，携带触发的开关控件
 * 返回值: 无
 */
static void myui_fan_switch_cb(lv_event_t *e)
{
    lv_obj_t *sw = lv_event_get_target(e);
    bool on = lv_obj_has_state(sw, LV_STATE_CHECKED);

    lv_obj_set_style_img_opa(s_myui.img_fan,
                             on ? LV_OPA_COVER : MYUI_ICON_OPA_OFF, 0);

    if (on)
    {
        if (s_myui.fan_timer == NULL)
        {
            s_myui.fan_timer = lv_timer_create(myui_fan_rotate_cb,
                                                MYUI_FAN_ROTATE_PERIOD_MS, NULL);
        }
    }
    else
    {
        if (s_myui.fan_timer != NULL)
        {
            lv_timer_del(s_myui.fan_timer);
            s_myui.fan_timer = NULL;
        }
    }

    printf("Fan: %s\r\n", on ? "ON" : "OFF");
    /* TODO: 在这里加小风扇的硬件控制代码 */
}

/*==================== 小熊摇摆动画 ====================*/
/* 摇摆关键帧（数值定义见 MyUI_config.h）：每帧的浮动偏移和摆动角度 */
static const int8_t bear_bob[MYUI_BEAR_FRAMES] = MYUI_BEAR_BOB_TABLE;
static const int16_t bear_angle[MYUI_BEAR_FRAMES] = MYUI_BEAR_ANGLE_TABLE;

/**
 * 功能: 小熊摇摆动画定时器回调（按关键帧表更新浮动位置和摆动角度）
 * 参数:
 *     timer - LVGL 定时器对象(回调签名需要，本函数未使用)
 * 返回值: 无
 */
static void myui_bear_anim_cb(lv_timer_t *timer)
{
    LV_UNUSED(timer);

    s_myui.bear_frame++;
    if (s_myui.bear_frame >= MYUI_BEAR_FRAMES)
    {
        s_myui.bear_frame = 0;
    }

    lv_obj_set_y(s_myui.img_bear, MYUI_BEAR_Y + bear_bob[s_myui.bear_frame]);
    lv_img_set_angle(s_myui.img_bear, bear_angle[s_myui.bear_frame]);
}

/*==================== 界面区域创建 ====================*/
/**
 * 功能: 创建背景底板(整屏铺满，最先创建所以在最底层)
 * 参数:
 *     parent - 父对象(屏幕)
 * 返回值: 无
 */
static void myui_create_bg(lv_obj_t *parent)
{
    s_myui.img_bg = lv_img_create(parent);

    lv_img_set_src(s_myui.img_bg, myui_bg_get_dsc());
    lv_obj_set_pos(s_myui.img_bg, 0, 0);
    lv_obj_set_style_img_opa(s_myui.img_bg, LV_OPA_TRANSP, 0);   /* 开屏动画: 从全黑淡入 */
}

/**
 * 功能: 创建顶部状态栏(时间 / 日期 / 小熊装饰 / WiFi信号条 / 电池)
 * 参数:
 *     parent - 父对象(屏幕)
 * 返回值: 无
 */
static void myui_create_status_bar(lv_obj_t *parent)
{
    static const lv_coord_t wifi_h[MYUI_WIFI_LEVEL_MAX] = {
        MYUI_WIFI_BAR_H1,
        MYUI_WIFI_BAR_H2,
        MYUI_WIFI_BAR_H3,
        MYUI_WIFI_BAR_H4
    };
    lv_obj_t *bar = NULL;
    lv_obj_t *b = NULL;
    int i = 0;

    bar = myui_create_card(parent, MYUI_BAR_X, MYUI_BAR_Y, MYUI_BAR_W,
                           MYUI_BAR_H, MYUI_BAR_RADIUS);
    lv_obj_set_style_border_width(bar, 0, 0);
    s_myui.obj_bar = bar;

    s_myui.lbl_time = lv_label_create(bar);
    lv_label_set_text(s_myui.lbl_time, "--:--");
    lv_obj_set_style_text_font(s_myui.lbl_time, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(s_myui.lbl_time, MYUI_COLOR_TEXT, 0);
    lv_obj_set_pos(s_myui.lbl_time, MYUI_TIME_X, MYUI_TIME_Y);

    s_myui.lbl_date = lv_label_create(bar);
    lv_label_set_text(s_myui.lbl_date, "--/--");
    lv_obj_set_style_text_font(s_myui.lbl_date, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(s_myui.lbl_date, MYUI_COLOR_TEXT_DIM, 0);
    lv_obj_set_pos(s_myui.lbl_date, MYUI_DATE_X, MYUI_DATE_Y);

    /* WiFi 信号条：4 根从矮到高 */
    for (i = 0; i < MYUI_WIFI_LEVEL_MAX; i++)
    {
        b = lv_obj_create(bar);
        lv_obj_clear_flag(b, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_size(b, MYUI_WIFI_BAR_W, wifi_h[i]);
        lv_obj_set_pos(b, MYUI_WIFI_BAR_X + i * MYUI_WIFI_BAR_GAP,
                       MYUI_WIFI_BAR_BOTTOM_Y - wifi_h[i]);
        lv_obj_set_style_bg_color(b, MYUI_COLOR_WIFI_OFF, 0);
        lv_obj_set_style_bg_opa(b, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(b, MYUI_WIFI_BAR_RADIUS, 0);
        lv_obj_set_style_border_width(b, 0, 0);
        lv_obj_set_style_pad_all(b, 0, 0);
        s_myui.wifi_bar[i] = b;
    }

    s_myui.lbl_batt = lv_label_create(bar);
    lv_label_set_text(s_myui.lbl_batt, LV_SYMBOL_BATTERY_EMPTY " --%");
    lv_obj_set_style_text_font(s_myui.lbl_batt, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(s_myui.lbl_batt, MYUI_COLOR_TEXT_DIM, 0);
    lv_obj_align(s_myui.lbl_batt, LV_ALIGN_RIGHT_MID, MYUI_BATT_OFFSET_X, 0);

    /* 小熊装饰：一直摇摆(保存定时器句柄) */
    s_myui.img_bear = lv_img_create(bar);
    lv_img_set_src(s_myui.img_bear, &icon_bear_dsc);
    lv_obj_set_pos(s_myui.img_bear, MYUI_BEAR_X, MYUI_BEAR_Y);
    s_myui.bear_timer = lv_timer_create(myui_bear_anim_cb, MYUI_BEAR_FRAME_MS, NULL);
}

/**
 * 功能: 创建左卡片(温度 / 湿度 / 天气 三行)
 * 参数:
 *     parent - 父对象(屏幕)
 * 返回值: 无
 */
static void myui_create_data_card(lv_obj_t *parent)
{
    lv_obj_t *card = NULL;

    card = myui_create_card(parent, MYUI_CARD_L_X, MYUI_CARD_Y, MYUI_CARD_L_W,
                            MYUI_CARD_H, MYUI_CARD_RADIUS);
    s_myui.obj_card_l = card;

    /* 第一行 温度 */
    s_myui.img_temp = lv_img_create(card);
    lv_img_set_src(s_myui.img_temp, &icon_temp_dsc);
    lv_obj_set_pos(s_myui.img_temp, MYUI_ICON_TEMP_X, MYUI_ICON_TEMP_Y);

    s_myui.lbl_temp = lv_label_create(card);
    lv_label_set_text(s_myui.lbl_temp, "--.-°C");
    lv_obj_set_style_text_font(s_myui.lbl_temp, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(s_myui.lbl_temp, MYUI_COLOR_TEMP, 0);
    lv_obj_set_pos(s_myui.lbl_temp, MYUI_LBL_TEMP_X, MYUI_LBL_TEMP_Y);

    s_myui.div_l1 = myui_create_divider(card, MYUI_DIV_X, MYUI_DIV1_Y, MYUI_DIV_W);

    /* 第二行 湿度 */
    s_myui.img_humi = lv_img_create(card);
    lv_img_set_src(s_myui.img_humi, &icon_humi_dsc);
    lv_obj_set_pos(s_myui.img_humi, MYUI_ICON_HUMI_X, MYUI_ICON_HUMI_Y);

    s_myui.lbl_humi = lv_label_create(card);
    lv_label_set_text(s_myui.lbl_humi, "--%");
    lv_obj_set_style_text_font(s_myui.lbl_humi, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(s_myui.lbl_humi, MYUI_COLOR_HUMI, 0);
    lv_obj_set_pos(s_myui.lbl_humi, MYUI_LBL_HUMI_X, MYUI_LBL_HUMI_Y);

    s_myui.div_l2 = myui_create_divider(card, MYUI_DIV_X, MYUI_DIV2_Y, MYUI_DIV_W);

    /* 第三行 空气质量(AQI)，复用云朵图标 */
    s_myui.img_weather = lv_img_create(card);
    lv_img_set_src(s_myui.img_weather, &w_cloudy_dsc);
    lv_obj_set_pos(s_myui.img_weather, MYUI_ICON_WEATHER_X, MYUI_ICON_WEATHER_Y);

    s_myui.lbl_weather = lv_label_create(card);
    lv_label_set_text(s_myui.lbl_weather, "AQI: --");
    lv_obj_set_style_text_font(s_myui.lbl_weather, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(s_myui.lbl_weather, MYUI_COLOR_WEATHER, 0);
    lv_obj_set_pos(s_myui.lbl_weather, MYUI_LBL_WEATHER_X, MYUI_LBL_WEATHER_Y);
}

/**
 * 功能: 创建右卡片(呼吸灯 / 小风扇 开关)
 * 参数:
 *     parent - 父对象(屏幕)
 * 返回值: 无
 */
static void myui_create_switch_card(lv_obj_t *parent)
{
    lv_obj_t *card = NULL;

    card = myui_create_card(parent, MYUI_CARD_R_X, MYUI_CARD_Y, MYUI_CARD_R_W,
                            MYUI_CARD_H, MYUI_CARD_RADIUS);
    s_myui.obj_card_r = card;

    /* 呼吸灯 */
    s_myui.img_breath = lv_img_create(card);
    lv_img_set_src(s_myui.img_breath, &icon_breath_dsc);
    lv_obj_set_pos(s_myui.img_breath, MYUI_ICON_BREATH_X, MYUI_ICON_BREATH_Y);
    lv_obj_set_style_img_opa(s_myui.img_breath, MYUI_ICON_OPA_OFF, 0);  /* 默认关闭，图标变暗 */

    s_myui.sw_breath = lv_switch_create(card);
    myui_style_switch(s_myui.sw_breath);
    lv_obj_set_pos(s_myui.sw_breath, MYUI_SW_BREATH_X, MYUI_SW_BREATH_Y);
    lv_obj_add_event_cb(s_myui.sw_breath, myui_breath_switch_cb, LV_EVENT_VALUE_CHANGED, NULL);

    s_myui.div_sw = myui_create_divider(card, MYUI_SW_DIV_X, MYUI_SW_DIV_Y, MYUI_SW_DIV_W);

    /* 小风扇 */
    s_myui.img_fan = lv_img_create(card);
    lv_img_set_src(s_myui.img_fan, &icon_fan_dsc);
    lv_obj_set_pos(s_myui.img_fan, MYUI_ICON_FAN_X, MYUI_ICON_FAN_Y);
    lv_obj_set_style_img_opa(s_myui.img_fan, MYUI_ICON_OPA_OFF, 0);

    s_myui.sw_fan = lv_switch_create(card);
    myui_style_switch(s_myui.sw_fan);
    lv_obj_set_pos(s_myui.sw_fan, MYUI_SW_FAN_X, MYUI_SW_FAN_Y);
    lv_obj_add_event_cb(s_myui.sw_fan, myui_fan_switch_cb, LV_EVENT_VALUE_CHANGED, NULL);
}

/*==================== 开屏动画 ====================*/
/* 开屏动画状态: 全黑 -> 校徽淡入 -> 停留 -> 界面淡入 */
typedef enum
{
    MYUI_SPLASH_BLACK = 0,   /* 全黑停留 */
    MYUI_SPLASH_BG,          /* 校徽背景淡入 */
    MYUI_SPLASH_HOLD,        /* 背景停留 */
    MYUI_SPLASH_UI,          /* 界面元素淡入 */
    MYUI_SPLASH_DONE         /* 已完成 */
} myui_splash_state_t;

/**
 * 功能: 开屏动画用——按百分比设置整个界面的不透明度(0=全透明, 100=恢复最终值)
 * 参数:
 *     pct - 不透明度百分比(0~100)
 * 返回值: 无
 * 说明: 每个元素按自身"最终透明度"比例缩放(如卡片最终是半透明 50%, pct=50 时按 25% 显示)
 */
static void myui_splash_set_ui_opa(uint8_t pct)
{
    lv_opa_t opa_full     = (lv_opa_t)((int)LV_OPA_COVER * pct / 100);
    lv_opa_t opa_dark     = (lv_opa_t)((int)LV_OPA_50 * pct / 100);
    lv_opa_t opa_border   = (lv_opa_t)((int)LV_OPA_10 * pct / 100);
    lv_opa_t opa_div      = (lv_opa_t)((int)LV_OPA_20 * pct / 100);
    lv_opa_t opa_icon_off = (lv_opa_t)((int)MYUI_ICON_OPA_OFF * pct / 100);
    bool breath_on        = (s_myui.sw_breath != NULL) && lv_obj_has_state(s_myui.sw_breath, LV_STATE_CHECKED);
    bool fan_on           = (s_myui.sw_fan != NULL) && lv_obj_has_state(s_myui.sw_fan, LV_STATE_CHECKED);
    int i = 0;

    /* 状态栏: 面板 + 文字 + WiFi条 + 小熊 */
    lv_obj_set_style_bg_opa(s_myui.obj_bar, opa_dark, 0);
    lv_obj_set_style_text_opa(s_myui.lbl_time, opa_full, 0);
    lv_obj_set_style_text_opa(s_myui.lbl_date, opa_full, 0);
    lv_obj_set_style_text_opa(s_myui.lbl_batt, opa_full, 0);
    for (i = 0; i < MYUI_WIFI_LEVEL_MAX; i++)
    {
        lv_obj_set_style_bg_opa(s_myui.wifi_bar[i], opa_full, 0);
    }
    lv_obj_set_style_img_opa(s_myui.img_bear, opa_full, 0);

    /* 左卡片: 面板 / 描边 / 分隔线 / 图标 / 数值 */
    lv_obj_set_style_bg_opa(s_myui.obj_card_l, opa_dark, 0);
    lv_obj_set_style_border_opa(s_myui.obj_card_l, opa_border, 0);
    lv_obj_set_style_bg_opa(s_myui.div_l1, opa_div, 0);
    lv_obj_set_style_bg_opa(s_myui.div_l2, opa_div, 0);
    lv_obj_set_style_img_opa(s_myui.img_temp, opa_full, 0);
    lv_obj_set_style_img_opa(s_myui.img_humi, opa_full, 0);
    lv_obj_set_style_img_opa(s_myui.img_weather, opa_full, 0);
    lv_obj_set_style_text_opa(s_myui.lbl_temp, opa_full, 0);
    lv_obj_set_style_text_opa(s_myui.lbl_humi, opa_full, 0);
    lv_obj_set_style_text_opa(s_myui.lbl_weather, opa_full, 0);

    /* 右卡片: 面板 / 描边 / 分隔线 / 开关(滑轨+旋钮) / 图标(根据开关当前状态决定目标透明度) */
    lv_obj_set_style_bg_opa(s_myui.obj_card_r, opa_dark, 0);
    lv_obj_set_style_border_opa(s_myui.obj_card_r, opa_border, 0);
    lv_obj_set_style_bg_opa(s_myui.div_sw, opa_div, 0);
    lv_obj_set_style_img_opa(s_myui.img_breath, breath_on ? opa_full : opa_icon_off, 0);
    lv_obj_set_style_img_opa(s_myui.img_fan, fan_on ? opa_full : opa_icon_off, 0);
    lv_obj_set_style_bg_opa(s_myui.sw_breath, opa_full, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(s_myui.sw_breath, opa_full, LV_PART_KNOB);
    lv_obj_set_style_bg_opa(s_myui.sw_fan, opa_full, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(s_myui.sw_fan, opa_full, LV_PART_KNOB);
}

static void myui_splash_cb(lv_timer_t *timer)
{
    int black_steps = MYUI_SPLASH_BLACK_MS / MYUI_SPLASH_TICK_MS;
    int bg_steps    = MYUI_SPLASH_BG_FADE_MS / MYUI_SPLASH_TICK_MS;
    int hold_steps  = MYUI_SPLASH_HOLD_MS / MYUI_SPLASH_TICK_MS;
    int ui_steps    = MYUI_SPLASH_UI_FADE_MS / MYUI_SPLASH_TICK_MS;

    if (black_steps < 1) black_steps = 1;
    if (bg_steps < 1)    bg_steps = 1;
    if (hold_steps < 1)  hold_steps = 1;
    if (ui_steps < 1)    ui_steps = 1;

    s_myui.splash_tick++;

    switch (s_myui.splash_state)
    {
    case MYUI_SPLASH_BLACK:
        if (s_myui.splash_tick >= black_steps)
        {
            s_myui.splash_state = MYUI_SPLASH_BG;
            s_myui.splash_tick  = 0;
        }
        break;

    case MYUI_SPLASH_BG:
        lv_obj_set_style_img_opa(s_myui.img_bg,
            (lv_opa_t)((int)LV_OPA_COVER * s_myui.splash_tick / bg_steps), 0);
        if (s_myui.splash_tick >= bg_steps)
        {
            lv_obj_set_style_img_opa(s_myui.img_bg, LV_OPA_COVER, 0);
            s_myui.splash_state = MYUI_SPLASH_HOLD;
            s_myui.splash_tick  = 0;
        }
        break;

    case MYUI_SPLASH_HOLD:
        if (s_myui.splash_tick >= hold_steps)
        {
            s_myui.splash_state = MYUI_SPLASH_UI;
            s_myui.splash_tick  = 0;
            lv_obj_clear_flag(s_myui.obj_bar, LV_OBJ_FLAG_HIDDEN);
            lv_obj_clear_flag(s_myui.obj_card_l, LV_OBJ_FLAG_HIDDEN);
            lv_obj_clear_flag(s_myui.obj_card_r, LV_OBJ_FLAG_HIDDEN);
        }
        break;

    case MYUI_SPLASH_UI:
        myui_splash_set_ui_opa((uint8_t)(100 * s_myui.splash_tick / ui_steps));
        if (s_myui.splash_tick >= ui_steps)
        {
            myui_splash_set_ui_opa(100);
            s_myui.splash_state = MYUI_SPLASH_DONE;
            s_myui.splash_timer = NULL;
            lv_timer_del(timer);
        }
        break;

    default:
        s_myui.splash_timer = NULL;
        lv_timer_del(timer);
        break;
    }
}

/*==================== 界面创建接口 ====================*/
/**
 * 功能: 创建环境监测界面(开机调用一次, 需在 lv_init/lv_port_disp_init 之后)
 * 参数:
 *     无
 * 返回值: 0-成功，-1-LVGL未初始化，-3-重复初始化
 */
int myui_init(void)
{
    lv_obj_t *scr = lv_scr_act();

    if (scr == NULL)
    {
        return MYUI_ERR_NOT_INIT;
    }
    if (s_myui.lbl_time != NULL)
    {
        return MYUI_ERR_STATE;
    }

    lv_obj_set_style_bg_color(scr, MYUI_COLOR_SCREEN_BG, 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    myui_create_bg(scr);
    myui_create_status_bar(scr);
    myui_create_data_card(scr);
    myui_create_switch_card(scr);

    /* 开屏动画: 全黑 -> 校徽淡入 -> 停留 -> 界面淡入 */
    s_myui.splash_state = MYUI_SPLASH_BLACK;
    s_myui.splash_tick = 0;
    myui_splash_set_ui_opa(0);
    /* 背景淡入阶段先隐藏界面元素: 隐藏的对象不参与渲染, 每帧少一大半工作量 */
    lv_obj_add_flag(s_myui.obj_bar, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_myui.obj_card_l, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_myui.obj_card_r, LV_OBJ_FLAG_HIDDEN);
    s_myui.splash_timer = lv_timer_create(myui_splash_cb, MYUI_SPLASH_TICK_MS, NULL);

    return MYUI_OK;
}

/*==================== 数据更新接口 ====================*/
/**
 * 功能: 更新状态栏时间显示
 * 参数:
 *     hour - 小时(0~23)
 *     minute - 分钟(0~59)
 * 返回值: 0-成功，-1-界面未初始化，-2-参数超出范围
 */
int myui_set_time(int hour, int minute)
{
    if (s_myui.lbl_time == NULL)
    {
        return MYUI_ERR_NOT_INIT;
    }
    if ((hour < MYUI_HOUR_MIN) || (hour > MYUI_HOUR_MAX)
        || (minute < MYUI_MINUTE_MIN) || (minute > MYUI_MINUTE_MAX))
    {
        return MYUI_ERR_PARAM;
    }

    lv_label_set_text_fmt(s_myui.lbl_time, "%02d:%02d", hour, minute);

    return MYUI_OK;
}

/**
 * 功能: 更新状态栏日期显示
 * 参数:
 *     month - 月份(1~12)
 *     day - 日(1~31)
 * 返回值: 0-成功，-1-界面未初始化，-2-参数超出范围
 */
int myui_set_date(int month, int day)
{
    if (s_myui.lbl_date == NULL)
    {
        return MYUI_ERR_NOT_INIT;
    }
    if ((month < MYUI_MONTH_MIN) || (month > MYUI_MONTH_MAX)
        || (day < MYUI_DAY_MIN) || (day > MYUI_DAY_MAX))
    {
        return MYUI_ERR_PARAM;
    }

    /* 中文日期（如 10月15日 周三）等字库补好后换过来 */
    lv_label_set_text_fmt(s_myui.lbl_date, "%d/%d", month, day);

    return MYUI_OK;
}

/**
 * 功能: 更新温度/湿度显示
 * 参数:
 *     temp - 温度(°C)，可带一位小数，范围 -50.0 ~ 150.0
 *     humi - 湿度(%)，范围 0 ~ 100
 * 返回值: 0-成功，-1-界面未初始化，-2-参数超出范围
 */
int myui_set_env_data(float temp, int humi)
{
    int temp_x10 = 0;
    bool is_neg  = false;

    if ((s_myui.lbl_temp == NULL) || (s_myui.lbl_humi == NULL))
    {
        return MYUI_ERR_NOT_INIT;
    }
    if ((temp < MYUI_TEMP_MIN) || (temp > MYUI_TEMP_MAX)
        || (humi < MYUI_HUMI_MIN) || (humi > MYUI_HUMI_MAX))
    {
        return MYUI_ERR_PARAM;
    }

    /* 四舍五入转换为 0.1°C 整数，避免浮点精度截断及 -0.x°C 丢失负号 */
    temp_x10 = (int)(temp >= 0.0f ? (temp * MYUI_TEMP_DEC_SCALE + 0.5f)
                                  : (temp * MYUI_TEMP_DEC_SCALE - 0.5f));
    if (temp_x10 < 0)
    {
        is_neg = true;
        temp_x10 = -temp_x10;
    }

    lv_label_set_text_fmt(s_myui.lbl_temp, "%s%d.%d°C",
                          is_neg ? "-" : "",
                          temp_x10 / MYUI_TEMP_DEC_SCALE,
                          temp_x10 % MYUI_TEMP_DEC_SCALE);
    lv_label_set_text_fmt(s_myui.lbl_humi, "%d%%", humi);

    return MYUI_OK;
}

/**
 * 功能: 更新空气质量(AQI)显示
 * 参数:
 *   aqi - 空气质量指数(0 ~ 300)
 * 返回值: 0-成功，-1-界面未初始化，-2-参数超出范围
 */
int myui_set_aqi(int aqi)
{
    if (s_myui.lbl_weather == NULL)
    {
        return MYUI_ERR_NOT_INIT;
    }
    if ((aqi < 0) || (aqi > 300))
    {
        return MYUI_ERR_PARAM;
    }

    lv_label_set_text_fmt(s_myui.lbl_weather, "AQI: %d", aqi);

    return MYUI_OK;
}

/**
 * 功能: 更新电池电量显示(图标 + 百分比)
 * 参数:
 *     percent - 电量百分比(0 ~ 100)
 * 返回值: 0-成功，-1-界面未初始化，-2-参数超出范围
 */
int myui_set_battery(int percent)
{
    const char *sym = LV_SYMBOL_BATTERY_EMPTY;

    if (s_myui.lbl_batt == NULL)
    {
        return MYUI_ERR_NOT_INIT;
    }
    if ((percent < MYUI_BATT_MIN) || (percent > MYUI_BATT_MAX))
    {
        return MYUI_ERR_PARAM;
    }

    if (percent >= MYUI_BATT_TH_FULL)
    {
        sym = LV_SYMBOL_BATTERY_FULL;
    }
    else if (percent >= MYUI_BATT_TH_3)
    {
        sym = LV_SYMBOL_BATTERY_3;
    }
    else if (percent >= MYUI_BATT_TH_2)
    {
        sym = LV_SYMBOL_BATTERY_2;
    }
    else if (percent >= MYUI_BATT_TH_1)
    {
        sym = LV_SYMBOL_BATTERY_1;
    }

    lv_label_set_text_fmt(s_myui.lbl_batt, "%s %d%%", sym, percent);

    return MYUI_OK;
}

/**
 * 功能: 更新 WiFi 信号强度显示(点亮信号条数量)
 * 参数:
 *     level - 信号强度(0~4)，0 = 无信号
 * 返回值: 0-成功，-1-界面未初始化，-2-参数超出范围
 */
int myui_set_wifi(int level)
{
    int i = 0;

    if (s_myui.wifi_bar[0] == NULL)
    {
        return MYUI_ERR_NOT_INIT;
    }
    if ((level < 0) || (level > MYUI_WIFI_LEVEL_MAX))
    {
        return MYUI_ERR_PARAM;
    }

    for (i = 0; i < MYUI_WIFI_LEVEL_MAX; i++)
    {
        if (i < level)
        {
            lv_obj_set_style_bg_color(s_myui.wifi_bar[i], MYUI_COLOR_WIFI_ON, 0);
        }
        else
        {
            lv_obj_set_style_bg_color(s_myui.wifi_bar[i], MYUI_COLOR_WIFI_OFF, 0);
        }
    }

    return MYUI_OK;
}
