/**
 * MyUI_bg.h - 界面背景底板图片
 * 数据定义在 MyUI_bg.c（320x240，RGB565 小端序），通过 myui_bg_get_dsc 获取
 */
#ifndef __MYUI_BG_H
#define __MYUI_BG_H

#include "lvgl.h"

/* 获取背景图片描述符（只读，指向 Flash 中的图像数据） */
const lv_img_dsc_t *myui_bg_get_dsc(void);

#endif
