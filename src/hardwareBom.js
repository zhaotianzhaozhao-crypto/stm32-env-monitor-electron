/**
 * 硬件真源 BOM / 引脚 / 孪生网格映射（内部参考，不在运行时 UI 展示对照框）
 *
 * 【用途】HARDWARE_SCENES 供 config 场景表兜底；BOM/MESH_LABELS 给维护者对照 Blender 网格名。
 * 【约定】与 STM32F411 + ESP8266 环境屏固件一致；3D：红绿同尺寸一体(Group_Middle)+外壳(Group_FrontShell)；拆解只分硬件/外壳；协议键名（temp/humidity/aqi/btn）不可改。
 */

export const HARDWARE_BOM = [
  {
    id: 'mcu',
    name: '主控板',
    part: 'STM32F411CEU6',
    pin: '—',
    mesh: 'Mesh_STM32F411',
    note: '核心 MCU',
  },
  {
    id: 'screen',
    name: '彩色屏',
    part: 'ILI9341 320×240',
    pin: '软 SPI',
    mesh: 'Dynamic_Screen_Canvas',
    note: 'LVGL MyUI 状态栏+双卡；桌面孪生纹理按 MyUI_config×2 同步，不向设备推像素',
  },
  {
    id: 'dht11',
    name: '温湿度',
    part: 'DHT11',
    pin: 'PA0',
    mesh: 'Mesh_DHT11',
    sensors: ['temp', 'humidity'],
    note: '温度 ℃ / 湿度 %',
  },
  {
    id: 'mq2',
    name: '空气质量',
    part: 'MQ-2',
    pin: 'PA1 (AO)',
    mesh: 'Mesh_MQ2',
    sensors: ['aqi'],
    note: 'AQI 映射约 0–300',
  },
  {
    id: 'relay',
    name: '继电器输出',
    part: '继电器',
    pin: 'PA2',
    mesh: 'Mesh_Buzzer',
    note: '指令 buzzer:on/off（固件映射执行器）；GLB 无独立继电器网格，示意场景另建',
  },
  {
    id: 'ec11',
    name: '旋转编码器',
    part: 'EC11',
    pin: 'PA3 / PA4 (A/B)',
    mesh: 'Mesh_EC11',
    sensors: ['btn'],
    note: '仅 CW/CCW，无 SW 按键',
  },
  {
    id: 'wifi',
    name: 'Wi‑Fi 透传',
    part: 'ESP8266',
    pin: 'USART1',
    mesh: 'Mesh_ESP8266',
    note: '串口透传 MQTT JSON',
  },
  {
    id: 'pcb',
    name: '底板',
    part: 'PCB',
    pin: '—',
    mesh: 'Mesh_PCB',
    note: '模块安装基板',
  },
];

/** 3D 网格名 → 中文短标签（内部参考；UI 已关闭 CSS2D 元件框） */
export const MESH_LABELS = {
  Mesh_STM32F411: 'STM32F411',
  Mesh_DHT11: 'DHT11 · PA0',
  Mesh_MQ2: 'MQ-2 · PA1',
  Mesh_EC11: 'EC11 · PA3/4',
  Mesh_ESP8266: 'ESP8266 · USART1',
  Mesh_Buzzer: '继电器/蜂鸣 · PA2',
  Dynamic_Screen_Canvas: 'ILI9341 · MyUI',
  Mesh_PCB: 'PCB',
  Dynamic_Clickable_Knob: 'EC11 旋钮',
};

/** 场景切换：主 GLB（「我家」空间编辑已移除） */
export const HARDWARE_SCENES = [
  {
    id: 'main-glb',
    name: '设备',
    file: 'model.glb',
    kind: 'glb',
    caption: '',
  },
];
