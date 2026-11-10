/**
 * ILI9341 孪生屏显主题常量（逻辑 320×240；纹理按 SCREEN_SCALE 放大）
 *
 * 【对齐真源】F411 环境监测屏 MyUI V2（D:\\xxzz\\1 (1)\\1 与 env-screen-f411-cubemx）
 *   状态栏：时间 / 日期 / WiFi / 电池
 *   左栏：大温度 + 天气行 + 湿度行
 *   右栏：空气质量大数字 + 等级 + 底部刻度
 * 【为何独立】ThreeEngine 只负责绘制/命中；改布局或色板只动本文件。
 * 【改时注意】
 *   - 坐标必须与硬件 MyUI_config.h 对齐。
 *   - SCREEN_SKINS 的 id 仍可与 defaults.json 皮肤指令一致（桌面预览用；F411 硬件无皮肤页）。
 *   - F411 硬件无 breath/fan 开关，孪生屏亦不绘制对应控件。
 */

/** 纹理相对逻辑分辨率的缩放 */
export const SCREEN_SCALE = 2;

/**
 * MyUI V2 布局（逻辑像素，对齐 F411 MyUI_config.h）
 */
export const MYUI = {
  SCREEN_W: 320, SCREEN_H: 240,
  BAR_X: 0, BAR_Y: 0, BAR_W: 320, BAR_H: 70,
  TIME_X: 18, TIME_Y: 6, DATE_X: 96, DATE_Y: 9,
  BATT_OFFSET_X: -8, BATT_OFFSET_Y: 8,
  WIFI_LEVEL_MAX: 4, WIFI_BAR_W: 4, WIFI_BAR_GAP: 6, WIFI_BAR_X: 224,
  WIFI_BAR_BOTTOM_Y: 25, WIFI_BAR_RADIUS: 1,
  WIFI_BAR_H: [5, 8, 11, 14],
  CARD_Y: 36, CARD_H: 200, CARD_RADIUS: 10, CARD_BORDER_W: 1,
  CARD_L_X: 4, CARD_L_W: 204,
  CARD_R_X: 212, CARD_R_W: 104,
  LBL_TEMP_X: 14, LBL_TEMP_Y: 26,
  ROW1_LINE_Y: 102, ROW1_Y: 110,
  ROW2_LINE_Y: 134, ROW2_Y: 142,
  ROW_VALUE_X: 58, ROW_LINE_W: 172,
  AIR_X: 214, AIR_CAP_Y: 116, AIR_NUM_Y: 140, AIR_LEVEL_Y: 188,
  AIR_SEG_N: 24, AIR_SEG_X: 18, AIR_SEG_Y: 224, AIR_SEG_W: 7, AIR_SEG_GAP: 12,
  // 桌面皮肤菜单仍可用（非硬件页元素）
  LM_X: 18, LM_Y: 34, LM_W: 284, LM_H: 188, LM_R: 14,
  LM_CLOSE_S: 22, LM_CLOSE_PAD: 8,
  LM_SLIDER_X: 20, LM_SLIDER_Y: 78, LM_SLIDER_W: 244, LM_SLIDER_H: 18,
  LM_SW_Y: 128, LM_SW_SIZE: 26, LM_SW_GAP: 10,
};

/**
 * 硬件屏色板（industrial-dark 对齐 F411 MyUI 默认色）
 * 其余皮肤仅桌面孪生预览（F411 当前无皮肤系统）。
 */
export const SCREEN_SKINS = {
  'industrial-dark': {
    id: 'industrial-dark',
    SCREEN_BG: '#000000',
    BAR_BG: 'rgba(0,0,0,0.35)',
    TEMP: '#FFD96A',
    HUMI: '#BBEBF6',
    WEATHER: '#CFF2D6',
    AIR: '#A8E6B8',
    AIR_DIM: '#7FB8A6',
    HAIRLINE: '#262E37',
    TEXT: '#F2F5F7',
    TEXT_DIM: '#C8D0D6',
    ACCENT: '#38D39F',
    WIFI_ON: '#8FE3C2',
    WIFI_OFF: '#5A636B',
    SW_TRACK: '#39424B',
    CARD_BG: 'rgba(0,0,0,0.00)',
    CARD_BORDER: 'rgba(255,255,255,0.00)',
    DIV: '#262E37',
    FONT_WEIGHT: 'bold',
    CARD_RADIUS: 10,
    AQI_EMPHASIS: false,
    GLOW_GOOD: '#24967F',
    GLOW_MODERATE: '#96701E',
    GLOW_POOR: '#96341F',
    GLOW_BAD: '#8C1E1E',
  },
  'mist-blue': {
    id: 'mist-blue',
    SCREEN_BG: '#0E1624',
    BAR_BG: 'rgba(18, 32, 52, 0.92)',
    TEMP: '#7DD3FC',
    HUMI: '#93C5FD',
    WEATHER: '#A5B4FC',
    AIR: '#7DD3FC',
    AIR_DIM: '#64748B',
    HAIRLINE: '#1E293B',
    TEXT: '#E8F1FF',
    TEXT_DIM: '#94A3B8',
    ACCENT: '#38BDF8',
    WIFI_ON: '#7DD3FC',
    WIFI_OFF: '#334155',
    SW_TRACK: '#1E293B',
    CARD_BG: 'rgba(22, 36, 58, 0.00)',
    CARD_BORDER: 'rgba(125, 211, 252, 0.00)',
    DIV: 'rgba(148, 163, 184, 0.18)',
    FONT_WEIGHT: '600',
    CARD_RADIUS: 14,
    AQI_EMPHASIS: false,
    GLOW_GOOD: '#0F766E',
    GLOW_MODERATE: '#A16207',
    GLOW_POOR: '#C2410C',
    GLOW_BAD: '#991B1B',
  },
  'soft-home': {
    id: 'soft-home',
    SCREEN_BG: '#2A2420',
    BAR_BG: 'rgba(42,36,32,0.88)',
    TEMP: '#E8B86D',
    HUMI: '#A8C5C0',
    WEATHER: '#C4B5A0',
    AIR: '#B7D4A8',
    AIR_DIM: '#8FA388',
    HAIRLINE: '#3A322C',
    TEXT: '#F5F0E8',
    TEXT_DIM: '#C9BDB0',
    ACCENT: '#C4A574',
    WIFI_ON: '#D4B896',
    WIFI_OFF: '#5C534C',
    SW_TRACK: '#4A433C',
    CARD_BG: 'rgba(58,50,44,0.00)',
    CARD_BORDER: 'rgba(212,184,150,0.00)',
    DIV: 'rgba(245,240,232,0.12)',
    FONT_WEIGHT: '600',
    CARD_RADIUS: 14,
    AQI_EMPHASIS: false,
    GLOW_GOOD: '#3F6B4E',
    GLOW_MODERATE: '#8A6A2F',
    GLOW_POOR: '#8A4A2F',
    GLOW_BAD: '#7A2E2E',
  },
  'ops-cyan': {
    id: 'ops-cyan',
    SCREEN_BG: '#050B10',
    BAR_BG: 'rgba(7,19,26,0.92)',
    TEMP: '#D4A84B',
    HUMI: '#5EEAD4',
    WEATHER: '#2DD4BF',
    AIR: '#2DD4BF',
    AIR_DIM: '#0F766E',
    HAIRLINE: '#0F1C24',
    TEXT: '#E8FFFB',
    TEXT_DIM: '#94A3B8',
    ACCENT: '#0EA5A0',
    WIFI_ON: '#2DD4BF',
    WIFI_OFF: '#334155',
    SW_TRACK: '#1E293B',
    CARD_BG: 'rgba(8,24,32,0.00)',
    CARD_BORDER: 'rgba(14,165,160,0.00)',
    DIV: 'rgba(45,212,191,0.18)',
    FONT_WEIGHT: 'bold',
    CARD_RADIUS: 8,
    AQI_EMPHASIS: true,
    GLOW_GOOD: '#0F766E',
    GLOW_MODERATE: '#A16207',
    GLOW_POOR: '#C2410C',
    GLOW_BAD: '#7F1D1D',
  },
};

/** AQI → 等级文案 / 强调色（对齐 myui_set_air） */
export function aqiLevelInfo(aqi, pal) {
  const n = Number(aqi);
  if (!Number.isFinite(n)) {
    return { level: '--', color: pal?.AIR || '#A8E6B8', glow: pal?.GLOW_GOOD || '#24967F', lit: 1 };
  }
  let level = '优';
  let color = pal?.AIR || '#A8E6B8';
  let glow = pal?.GLOW_GOOD || '#24967F';
  if (n <= 50) {
    level = '优';
    color = pal?.AIR || '#A8E6B8';
    glow = pal?.GLOW_GOOD || '#24967F';
  } else if (n <= 100) {
    level = '良';
    color = pal?.TEMP || '#FFD96A';
    glow = pal?.GLOW_MODERATE || '#96701E';
  } else if (n <= 150) {
    level = '轻度';
    color = '#FF9F45';
    glow = pal?.GLOW_POOR || '#96341F';
  } else {
    level = '差';
    color = '#FF6B6B';
    glow = pal?.GLOW_BAD || '#8C1E1E';
  }
  let lit = Math.round((Math.max(0, Math.min(500, n)) * 24) / 150);
  if (lit < 1) lit = 1;
  if (lit > 24) lit = 24;
  return { level, color, glow, lit };
}
