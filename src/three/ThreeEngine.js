import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { SCREEN_SCALE, MYUI, SCREEN_SKINS, aqiLevelInfo } from './screenTheme.js';

/* =============================================================================
 * ThreeEngine — 3D 场景 / GLB 模型 / ILI9341 孪生屏 / 交互
 *
 * 【做什么】在视口容器内初始化 Three.js：加载 model.glb；
 *   用 CanvasTexture 绘制 LVGL 风格屏显；处理外壳美学按键（灯光/场景/设置）。
 * 【依赖】screenTheme.js（布局/色板）、gsap（拆解动画）、OrbitControls；右下角为玻璃坐标球（彩色轴）。
 * 【回调】onClickCallback 协议：
 *   screen:breath:on|off —— 外壳「灯光」键切换呼吸灯
 *   其余 Clickable_Btn_* 外壳键名
 * 【改时注意】
 *   drawScreen 永不绘制校徽底板；皮肤只换 SCREEN_SKINS。
 * ============================================================================= */

const SCHEMATIC_FILE = '__hardware_schematic__'; // 旧示意文件名 → 落到主 GLB
const HOME_FILE = '__home_editor__'; // 已移除的「我家」编辑器 → 落到主 GLB
const FALLBACK_GLB = 'model.glb';


export function initThreeEngine(container, onClickCallback) {
  const scene = new THREE.Scene();
  // 浅色磨砂展厅：透明清屏让 CSS 视口底透出；兜底浅灰避免闪黑
  scene.background = new THREE.Color(0xf0f2f5);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 50);
  // 初始展示大小：相机离模型越近，看起来越大（模型按真实米制，板约 86mm）
  // 改这里的三个数即可；Y 负向朝屏前，|Y| 从 0.22~0.40 常用，越小越大
  const initialCameraPosition = new THREE.Vector3(0, -0.28, 0.10);
  camera.position.copy(initialCameraPosition);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0xf0f2f5, 1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2;
  const initialTargetPosition = new THREE.Vector3(0, 0, 0);
  controls.target.copy(initialTargetPosition);

  // 浅色磨砂展台：柔和棚拍光，避免把深色机身洗白
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
  scene.add(ambientLight);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4d8de, 0.55);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.85);
  dirLight.position.set(2.2, 4.5, 3.2);
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xe8eef8, 0.85);
  fillLight.position.set(-2.4, -1.6, 1.8);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
  rimLight.position.set(0, 2.5, -3.2);
  scene.add(rimLight);

  // 圆形地台已移除；保留空钩子以免旧调用报错
  function placeShowroomUnder(/* model */) {}
  function hideShowroomPedestal() {}

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // ILI9341 逻辑分辨率 320×240；纹理用 2× 便于清晰文字
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 640;
  screenCanvas.height = 480;
  const ctx = screenCanvas.getContext('2d');
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.flipY = false;

  let screenMesh = null;
  let knobMesh = null;
  let interactiveMeshes = [];
  let frontGroup = null;
  let middleGroup = null;
  let isExplodedState = false;
  let partLabelObjects = [];

  let currentHighlightMesh = null;
  let currentHighlightTween = null;
  let currentAlertLabel = null;

  const loader = new GLTFLoader();
  let currentModel = null;
  let loadingModel = null;
  let currentKind = 'glb';


  function disposeObject3D(root) {
    if (!root) return;
    root.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
        else child.material?.dispose?.();
      }
      if (child.isSprite) {
        child.material?.map?.dispose?.();
        child.material?.dispose?.();
      }
    });
  }

  function clearPartLabels() {
    partLabelObjects.forEach((obj) => {
      obj.removeFromParent();
      if (obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element);
    });
    partLabelObjects = [];
  }

  function clearCurrentModel() {
    clearPartLabels();
    if (!currentModel) return;
    scene.remove(currentModel);
    disposeObject3D(currentModel);
    currentModel = null;
    screenMesh = null;
    knobMesh = null;
    interactiveMeshes = [];
    frontGroup = null;
    middleGroup = null;
  }

  /** 绑定 GLB：居中、挂屏纹理、收集可点网格。网格名与 hardwareBom / Blender 导出约定一致。 */
  function bindModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    // 按包围盒把初始相机拉到合适距离（fill 越小画面里模型越大；默认 1.55）
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.01);
    const fitFill = 1.55; // ← 想再大就改小，例如 1.25
    const fitDist = (maxDim * fitFill) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    initialCameraPosition.set(0, -fitDist, fitDist * 0.36);
    camera.position.copy(initialCameraPosition);
    controls.target.set(0, 0, 0);
    controls.update();

    frontGroup = model.getObjectByName('Group_FrontShell'); // 外壳整组（Panel_Front+Panel_Shell_Body）
    middleGroup = model.getObjectByName('Group_Middle'); // 硬件整体（红板+同尺寸绿板+器件）
    interactiveMeshes = [];
    screenMesh = null;
    knobMesh = null;

    model.traverse((child) => {
      if (child.isMesh) {
        if (child.name === 'Dynamic_Screen_Canvas') {
          // 孪生屏网格：必须挂 CanvasTexture，否则 drawScreen 无可见输出
          screenMesh = child;
          const oldMat = child.material;
          const newMat = oldMat.clone();
          newMat.map = screenTexture;
          newMat.emissiveMap = screenTexture;
          newMat.emissive = new THREE.Color(0xffffff);
          newMat.emissiveIntensity = 1.5;
          child.material = newMat;
          try { oldMat.dispose?.(); } catch (_) {}
        }
        if (child.name.includes('Clickable_Btn_')) {
          // 外壳美学按键（场景/灯光/设置），非 MCU 硬件 SW（btn 仅 CW/CCW）
          interactiveMeshes.push(child);
        }
        if (child.name === 'Dynamic_Clickable_Knob') {
          knobMesh = child; // EC11 旋钮视觉；上行 btn:CW/CCW 时 rotateKnob
        }
        if (child.name === 'Panel_Front' || child.name === 'Panel_Shell_Body') {
          // 半透明外壳网格：强制 transparent，保留 glTF 导出的 opacity
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (!m) return;
            m.transparent = true;
            m.depthWrite = false;
            if (typeof m.opacity !== 'number' || m.opacity >= 0.99) m.opacity = 0.28;
          });
        }
      }
    });

    scene.add(model);
    currentModel = model;
    currentKind = 'glb';
    placeShowroomUnder(model);
    drawScreen('--', '--', '--');
  }


  function loadModel(fileName = 'model.glb') {
    const url = String(fileName || 'model.glb').replace(/^\/+/, '');
    if (loadingModel === url && currentModel) return Promise.resolve(currentModel);

    if (
      url === HOME_FILE ||
      url === 'home-editor' ||
      url === SCHEMATIC_FILE ||
      url === 'hardware-schematic'
    ) {
      // 「我家」/旧示意已移除：安全落到主 GLB，避免崩溃
      return loadModel(FALLBACK_GLB);
    }


    return new Promise((resolve, reject) => {
      loadingModel = url;
      loader.load(
        url,
        (gltf) => {
          clearCurrentModel();
          bindModel(gltf.scene);
          loadingModel = null;
          camera.position.copy(initialCameraPosition);
          controls.target.copy(initialTargetPosition);
          resolve(currentModel);
        },
        undefined,
        (err) => {
          loadingModel = null;
          reject(err);
        }
      );
    });
  }

  loadModel('model.glb').catch((err) => {
    console.error('[ThreeEngine] 初始模型加载失败', err);
  });

  /* ========== ILI9341 屏显（主题常量见 ./screenTheme.js） ========== */
  const S = SCREEN_SCALE; // 逻辑→纹理倍率；sx(v)=v*S

  let screenSkinId = 'industrial-dark';
  function getScreenPalette() {
    const id = screenSkinId === 'minimal-light' ? 'mist-blue' : screenSkinId;
    return SCREEN_SKINS[id] || SCREEN_SKINS['industrial-dark'];
  }

  /** 屏显运行态：可由 MQTT 上行 setScreenState 或本地点击改写 */
  const screenState = {
    wifiLevel: 0,
    battery: null, // null → 显示 --%（与硬件初值一致）
    hour: null,
    minute: null,
    month: null,
    day: null,
    weatherCond: 0,
    weatherLow: null,
    weatherHigh: null,
    breathOn: false, // 保留状态字段以兼容旧 MQTT；F411 页不绘制开关
    fanOn: false,
    buzzerOn: false,
  };
  let lastScreenArgs = ['--', '--', '--'];

  function sx(v) { return v * S; }

  function roundRectPath(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function fillRoundRect(c, x, y, w, h, r, fill, stroke, strokeW) {
    roundRectPath(c, x, y, w, h, r);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = strokeW || 1;
      c.stroke();
    }
  }

  function formatTemp(temp) {
    if (temp === '--' || temp === undefined || temp === null || temp === '') return '--.-°C';
    const n = Number(temp);
    if (!Number.isFinite(n)) return String(temp);
    const scaled = Math.round(n * 10);
    const sign = scaled < 0 ? '-' : '';
    const abs = Math.abs(scaled);
    return `${sign}${Math.trunc(abs / 10)}.${abs % 10}°C`;
  }

  function formatHumi(humi) {
    if (humi === '--' || humi === undefined || humi === null || humi === '') return '--%';
    const n = Number(humi);
    if (!Number.isFinite(n)) return String(humi);
    return `${Math.round(n)}%`;
  }

  function formatAqi(aqi) {
    if (aqi === '--' || aqi === undefined || aqi === null || aqi === '') return 'AQI: --';
    const n = Number(aqi);
    if (!Number.isFinite(n)) return `AQI: ${aqi}`;
    return `AQI: ${Math.round(n)}`;
  }

  function formatTempMain(temp) {
    if (temp === '--' || temp === undefined || temp === null || temp === '') return '--.-';
    const n = Number(temp);
    if (!Number.isFinite(n)) return String(temp);
    const scaled = Math.round(n * 10);
    const sign = scaled < 0 ? '-' : '';
    const abs = Math.abs(scaled);
    return `${sign}${Math.trunc(abs / 10)}.${abs % 10}`;
  }

  function formatAqiNum(aqi) {
    if (aqi === '--' || aqi === undefined || aqi === null || aqi === '') return '--';
    const n = Number(aqi);
    if (!Number.isFinite(n)) return String(aqi);
    return String(Math.round(n));
  }

  function formatWeatherRange(state) {
    const low = state.weatherLow;
    const high = state.weatherHigh;
    if (low == null || high == null || !Number.isFinite(Number(low)) || !Number.isFinite(Number(high))) {
      return '--~--°C';
    }
    return `${Math.round(Number(low))}~${Math.round(Number(high))}°C`;
  }

  function battSymbol(percent) {
    if (percent == null || !Number.isFinite(Number(percent))) return '▁';
    const p = Number(percent);
    if (p >= 95) return '█';
    if (p >= 70) return '▇';
    if (p >= 45) return '▅';
    if (p >= 20) return '▃';
    return '▁';
  }

  /**
   * LVGL 孪生屏绘制（Canvas 2D → CanvasTexture）— 对齐 F411 MyUI V2
   *
   * 结构：状态栏（时/日/WiFi/电量）+ 左栏大温度/天气/湿度 + 右栏空气质量。
   * 不绘制 breath/fan/蜂鸣开关（硬件页无此控件）。
   * 维护：改布局先改 screenTheme.MYUI；禁止加校徽/bg 图。
   */
  function drawScreen(temp, humi, aqi) {
    if (!ctx) return;
    lastScreenArgs = [temp, humi, aqi];
    const W = screenCanvas.width;
    const H = screenCanvas.height;
    const C = getScreenPalette();
    const fw = C.FONT_WEIGHT || 'bold';

    // 氛围光晕（按 AQI 等级）
    const info = aqiLevelInfo(aqi, C);
    ctx.fillStyle = C.SCREEN_BG;
    ctx.fillRect(0, 0, W, H);
    {
      const g = ctx.createRadialGradient(W * 0.72, H * 0.55, sx(10), W * 0.72, H * 0.55, sx(160));
      g.addColorStop(0, `${info.glow}66`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // —— 状态栏 ——
    fillRoundRect(
      ctx,
      sx(MYUI.BAR_X), sx(MYUI.BAR_Y), sx(MYUI.BAR_W), sx(MYUI.BAR_H),
      0, C.BAR_BG || 'rgba(0,0,0,0.35)'
    );

    const now = new Date();
    const hour = screenState.hour != null ? screenState.hour : now.getHours();
    const minute = screenState.minute != null ? screenState.minute : now.getMinutes();
    const mon = screenState.month != null ? screenState.month : (now.getMonth() + 1);
    const day = screenState.day != null ? screenState.day : now.getDate();
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.TEXT;
    ctx.font = `${fw} 48px Montserrat, Segoe UI, Arial, sans-serif`;
    ctx.fillText(`${hh}:${mm}`, sx(MYUI.TIME_X), sx(MYUI.TIME_Y));

    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = '28px Montserrat, Segoe UI, Arial, sans-serif';
    ctx.fillText(`${mon}/${day}`, sx(MYUI.DATE_X), sx(MYUI.DATE_Y));

    const level = Math.max(0, Math.min(MYUI.WIFI_LEVEL_MAX, Number(screenState.wifiLevel) || 0));
    for (let i = 0; i < MYUI.WIFI_LEVEL_MAX; i++) {
      const bh = MYUI.WIFI_BAR_H[i];
      const bx = sx(MYUI.WIFI_BAR_X + i * MYUI.WIFI_BAR_GAP);
      const by = sx(MYUI.WIFI_BAR_BOTTOM_Y - bh);
      fillRoundRect(
        ctx, bx, by, sx(MYUI.WIFI_BAR_W), sx(bh),
        sx(MYUI.WIFI_BAR_RADIUS),
        i < level ? C.WIFI_ON : C.WIFI_OFF
      );
    }

    const battTxt = screenState.battery == null || !Number.isFinite(Number(screenState.battery))
      ? `${battSymbol(null)} --%`
      : `${battSymbol(screenState.battery)} ${Math.round(Number(screenState.battery))}%`;
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = '28px Montserrat, Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(battTxt, W + sx(MYUI.BATT_OFFSET_X), sx(MYUI.BATT_OFFSET_Y));
    ctx.textAlign = 'left';

    // —— 左栏：大温度 + 天气 + 湿度 ——
    const lx = sx(MYUI.CARD_L_X);
    const ly = sx(MYUI.CARD_Y);

    ctx.fillStyle = C.TEMP;
    ctx.font = `${fw} 88px Montserrat, Segoe UI, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    const tempMain = formatTempMain(temp);
    ctx.fillText(tempMain, lx + sx(MYUI.LBL_TEMP_X), ly + sx(MYUI.LBL_TEMP_Y));
    const tempW = ctx.measureText(tempMain).width;
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = '28px Montserrat, Segoe UI, Arial, sans-serif';
    ctx.fillText('°C', lx + sx(MYUI.LBL_TEMP_X) + tempW + sx(4), ly + sx(MYUI.LBL_TEMP_Y) + sx(36));

    // 天气行
    ctx.fillStyle = C.HAIRLINE || C.DIV;
    ctx.fillRect(lx + sx(MYUI.LBL_TEMP_X), ly + sx(MYUI.ROW1_LINE_Y - MYUI.CARD_Y), sx(MYUI.ROW_LINE_W), sx(1));
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText('天气', lx + sx(MYUI.LBL_TEMP_X), ly + sx(MYUI.ROW1_Y - MYUI.CARD_Y));
    ctx.fillStyle = C.WEATHER;
    ctx.font = `${fw} 36px Montserrat, Segoe UI, Arial, sans-serif`;
    ctx.fillText(formatWeatherRange(screenState), lx + sx(MYUI.ROW_VALUE_X), ly + sx(MYUI.ROW1_Y - MYUI.CARD_Y - 5));

    // 湿度行
    ctx.fillStyle = C.HAIRLINE || C.DIV;
    ctx.fillRect(lx + sx(MYUI.LBL_TEMP_X), ly + sx(MYUI.ROW2_LINE_Y - MYUI.CARD_Y), sx(MYUI.ROW_LINE_W), sx(1));
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText('湿度', lx + sx(MYUI.LBL_TEMP_X), ly + sx(MYUI.ROW2_Y - MYUI.CARD_Y));
    ctx.fillStyle = C.HUMI;
    ctx.font = `${fw} 36px Montserrat, Segoe UI, Arial, sans-serif`;
    ctx.fillText(formatHumi(humi), lx + sx(MYUI.ROW_VALUE_X), ly + sx(MYUI.ROW2_Y - MYUI.CARD_Y - 5));

    // —— 右栏：空气质量 ——
    ctx.fillStyle = C.AIR_DIM || C.TEXT_DIM;
    ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('空气质量', sx(MYUI.AIR_X), sx(MYUI.AIR_CAP_Y));

    ctx.fillStyle = info.color;
    ctx.font = `${fw} 88px Montserrat, Segoe UI, Arial, sans-serif`;
    const aqiTxt = formatAqiNum(aqi);
    ctx.fillText(aqiTxt, sx(MYUI.AIR_X), sx(MYUI.AIR_NUM_Y));

    ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(info.level, sx(MYUI.AIR_X), sx(MYUI.AIR_LEVEL_Y));

    // 底部 24 段刻度
    for (let i = 0; i < MYUI.AIR_SEG_N; i++) {
      const sx0 = sx(MYUI.AIR_SEG_X + i * MYUI.AIR_SEG_GAP);
      const sy0 = sx(MYUI.AIR_SEG_Y);
      ctx.fillStyle = i < info.lit ? info.color : (C.HAIRLINE || '#262E37');
      ctx.fillRect(sx0, sy0, sx(MYUI.AIR_SEG_W), sx(2));
    }

    screenTexture.needsUpdate = true;
  }


  /** 切换 LVGL 风格（孪生预览立即重绘） */
  function setScreenSkin(id) {
    const mapped = id === 'minimal-light' ? 'mist-blue' : id;
    const next = SCREEN_SKINS[mapped] ? mapped : 'industrial-dark';
    screenSkinId = next;
    drawScreen(...lastScreenArgs);
    return screenSkinId;
  }

  /** 更新屏显附属状态（WiFi / 电池 / 开关），立即重绘 */
  function setScreenState(partial = {}) {
    if (partial.wifiLevel !== undefined) screenState.wifiLevel = partial.wifiLevel;
    if (partial.battery !== undefined) screenState.battery = partial.battery;
    if (partial.hour !== undefined) screenState.hour = partial.hour;
    if (partial.minute !== undefined) screenState.minute = partial.minute;
    if (partial.month !== undefined) screenState.month = partial.month;
    if (partial.day !== undefined) screenState.day = partial.day;
    if (partial.weatherCond !== undefined) screenState.weatherCond = partial.weatherCond;
    if (partial.weatherLow !== undefined) screenState.weatherLow = partial.weatherLow;
    if (partial.weatherHigh !== undefined) screenState.weatherHigh = partial.weatherHigh;
    if (partial.breathOn !== undefined) screenState.breathOn = !!partial.breathOn;
    if (partial.fanOn !== undefined) screenState.fanOn = !!partial.fanOn;
    if (partial.buzzerOn !== undefined) screenState.buzzerOn = !!partial.buzzerOn;
    drawScreen(...lastScreenArgs);
  }

  function toggleScreenControl(id, forceOn) {
    const map = { breath: 'breathOn', fan: 'fanOn', buzzer: 'buzzerOn' };
    const stateKey = map[id];
    if (!stateKey) return null;
    const next = forceOn === undefined ? !screenState[stateKey] : !!forceOn;
    screenState[stateKey] = next;
    drawScreen(...lastScreenArgs);
    return { id, on: next };
  }

  // 本地时钟：每 10s 检查一次分钟变化，仅在分钟跳变且处于 GLB 场景时重绘纹理
  let lastClockMinute = new Date().getMinutes();
  const clockTimer = setInterval(() => {
    const curMin = new Date().getMinutes();
    if (curMin !== lastClockMinute) {
      lastClockMinute = curMin;
      if (currentKind === 'glb') {
        drawScreen(...lastScreenArgs);
      }
    }
  }, 10000);

  const onMouseClick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 外壳美学按键
    const intersects = raycaster.intersectObjects(interactiveMeshes, false);
    if (intersects.length === 0) return;

    const clickedObject = intersects[0].object;
    if (clickedObject.userData._baseZ === undefined) {
      clickedObject.userData._baseZ = clickedObject.position.z;
    }
    const pulseButton = (mesh) => {
      const baseZ = mesh.userData._baseZ;
      mesh.position.z = baseZ - 0.002;
      if (mesh.userData._pressTimer) clearTimeout(mesh.userData._pressTimer);
      mesh.userData._pressTimer = setTimeout(() => {
        mesh.position.z = baseZ;
        mesh.userData._pressTimer = null;
      }, 100);
    };
    if (onClickCallback) {
      let keyName = clickedObject.name;
      if (keyName.includes('Clickable_Btn_')) keyName = keyName.split('_').pop();
      // 灯光键：本地切换呼吸灯开关并回调
      if (keyName === '灯光') {
        const toggled = toggleScreenControl('breath');
        if (toggled) {
          onClickCallback(`screen:${toggled.id}:${toggled.on ? 'on' : 'off'}`);
          pulseButton(clickedObject);
          return;
        }
      }
      onClickCallback(keyName);
    }

    pulseButton(clickedObject);
  };
  renderer.domElement.addEventListener('click', onMouseClick);

  const customCursor = document.createElement('div');
  customCursor.style.position = 'fixed';
  customCursor.style.width = '18px';
  customCursor.style.height = '18px';
  customCursor.style.borderRadius = '50%';
  customCursor.style.background = 'rgba(255, 255, 255, 0.92)';
  customCursor.style.border = '1px solid rgba(0, 0, 0, 0.25)';
  customCursor.style.boxShadow = '0 0 6px rgba(255, 255, 255, 0.6)';
  customCursor.style.pointerEvents = 'none';
  customCursor.style.transform = 'translate(-50%, -50%)';
  customCursor.style.zIndex = '9999';
  customCursor.style.display = 'none';
  document.body.appendChild(customCursor);

  const onPointerMove = (event) => {
    // 按住鼠标旋转 OrbitControls 时跳过悬停 Raycast
    if (event.buttons !== 0) {
      renderer.domElement.style.cursor = 'default';
      customCursor.style.display = 'none';
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    let hot = false;
    if (interactiveMeshes.length) {
      const intersects = raycaster.intersectObjects(interactiveMeshes, false);
      hot = intersects.length > 0;
    }
    if (!hot) {
      renderer.domElement.style.cursor = 'default';
      customCursor.style.display = 'none';
      return;
    }
    renderer.domElement.style.cursor = 'none';
    customCursor.style.left = `${event.clientX}px`;
    customCursor.style.top = `${event.clientY}px`;
    customCursor.style.display = 'block';
  };
  const onPointerLeave = () => {
    renderer.domElement.style.cursor = 'default';
    customCursor.style.display = 'none';
  };
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);

  /* —— 右下角坐标球（玻璃球 + 彩色轴，观感优化，无蜘蛛立方体） —— */
  const axesScene = new THREE.Scene();
  const axesCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 10);
  axesCamera.position.set(0, 0, 2.35);
  // 玻璃球：更高细分 + 更淡，降低突兀感
  const sphereGeom = new THREE.SphereGeometry(0.82, 48, 48);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x1a1d24,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  axesScene.add(new THREE.Mesh(sphereGeom, sphereMat));
  const wireGeom = new THREE.SphereGeometry(0.825, 24, 16);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x6b7280,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  axesScene.add(new THREE.Mesh(wireGeom, wireMat));

  // 用细圆柱轴 + 端点小球代替默认 AxesHelper 细线，小视口更清晰
  function addAxisShaft(dir, color, length = 1.02, radius = 0.028) {
    const geom = new THREE.CylinderGeometry(radius, radius, length, 10);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geom, mat);
    const mid = dir.clone().multiplyScalar(length * 0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    axesScene.add(mesh);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.55, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    tip.position.copy(dir.clone().multiplyScalar(length));
    axesScene.add(tip);
  }
  addAxisShaft(new THREE.Vector3(1, 0, 0), 0xf07178);
  addAxisShaft(new THREE.Vector3(0, 1, 0), 0x7fd962);
  addAxisShaft(new THREE.Vector3(0, 0, 1), 0x6cb6ff);

  function makeAxisLabel(text, color, position) {
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const size = Math.round(96 * dpr);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    cx.scale(dpr, dpr);
    cx.clearRect(0, 0, 96, 96);
    // 轻底圆，提升对比、抗锯齿观感
    cx.beginPath();
    cx.arc(48, 48, 22, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(12, 14, 18, 0.55)';
    cx.fill();
    cx.lineWidth = 1.5;
    cx.strokeStyle = 'rgba(255,255,255,0.12)';
    cx.stroke();
    cx.font = '700 34px Segoe UI, system-ui, Arial';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,0.55)';
    cx.shadowBlur = 4;
    cx.fillStyle = color;
    cx.fillText(text, 48, 49);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      depthTest: false,
      transparent: true,
      opacity: 0.96,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.42, 0.42, 0.42);
    sprite.position.copy(position);
    return sprite;
  }
  axesScene.add(makeAxisLabel('X', '#f07178', new THREE.Vector3(1.22, 0, 0)));
  axesScene.add(makeAxisLabel('Y', '#7fd962', new THREE.Vector3(0, 1.22, 0)));
  axesScene.add(makeAxisLabel('Z', '#6cb6ff', new THREE.Vector3(0, 0, 1.22)));
  const AXES_SIZE = 100;

  let animationId;
  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();

    const w = container.clientWidth;
    const h = container.clientHeight;

    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    axesCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(2.35);
    axesCamera.lookAt(0, 0, 0);

    const ax = w - AXES_SIZE - 12;
    const ay = 12;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(ax, ay, AXES_SIZE, AXES_SIZE);
    renderer.setViewport(ax, ay, AXES_SIZE, AXES_SIZE);
    renderer.render(axesScene, axesCamera);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
  }
  animate();

  const onWindowResize = () => {
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onWindowResize);

  function toggleExplode(isExplode) {
    isExplodedState = isExplode;
    if (!frontGroup || !middleGroup) return;

    // 拆解：外壳 Group_FrontShell ↔ 硬件整体 Group_Middle（红绿一体不拆）
    gsap.to(frontGroup.position, { y: isExplode ? -0.037 : 0, duration: 1.15, ease: 'power2.inOut' });
    gsap.to(middleGroup.position, { y: isExplode ? 0.037 : 0, duration: 1.15, ease: 'power2.inOut' });

    const panelFront = frontGroup.getObjectByName('Panel_Front');
    if (panelFront && panelFront.material) {
      // 半透明外壳：组装态保持导出透明度，勿拉回全不透明
      if (panelFront.userData._shellBaseOpacity == null) {
        panelFront.userData._shellBaseOpacity =
          typeof panelFront.material.opacity === 'number' ? panelFront.material.opacity : 0.35;
      }
      panelFront.material.transparent = true;
      gsap.to(panelFront.material, {
        opacity: isExplode ? 0.12 : panelFront.userData._shellBaseOpacity,
        duration: 1.15,
      });
    }

    // 拆解时略拉远/抬高相机，组装时交由调用方或 focus 复位
    if (isExplode && initialCameraPosition) {
      const base = initialCameraPosition;
      gsap.to(camera.position, {
        x: base.x * 1.08,
        y: base.y + 0.08,
        z: base.z * 1.12,
        duration: 1.15,
        ease: 'power2.inOut',
      });
    } else if (!isExplode) {
      focusOnHardware('reset');
    }
  }

  function focusOnHardware(type) {
    if (currentHighlightMesh) {
      if (currentHighlightTween) currentHighlightTween.kill();
      try {
        if (currentHighlightMesh.material && currentHighlightMesh.material.emissive) {
          currentHighlightMesh.material.emissive.setHex(0x000000);
          currentHighlightMesh.material.emissiveIntensity = 0;
        }
      } catch (_) { /* ignore */ }
      currentHighlightMesh = null;
    }
    if (currentAlertLabel) {
      currentAlertLabel.removeFromParent();
      currentAlertLabel = null;
    }

    if (type === 'reset') {
      gsap.to(camera.position, {
        x: initialCameraPosition.x, y: initialCameraPosition.y, z: initialCameraPosition.z,
        duration: 1.2, ease: 'power2.inOut',
      });
      gsap.to(controls.target, {
        x: initialTargetPosition.x, y: initialTargetPosition.y, z: initialTargetPosition.z,
        duration: 1.2, ease: 'power2.inOut',
      });
    }
  }

  const rotateKnob = (dir) => {
    if (!knobMesh) return;
    const step = (dir > 0 ? 1 : -1) * (Math.PI / 12);
    knobMesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), step);
  };

  const resetCamera = () => {
    focusOnHardware('reset');
  };

  // 对外 API：App.vue bootstrapRuntime / 屏控 / 场景切换 只应调用下列方法
  return {
    dispose: () => {
      cancelAnimationFrame(animationId);
      clearInterval(clockTimer);
      renderer.domElement.removeEventListener('click', onMouseClick);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', onWindowResize);
      if (customCursor.parentNode) customCursor.parentNode.removeChild(customCursor);
      clearCurrentModel();
      try { screenTexture.dispose(); } catch (_) {}
      try { disposeObject3D(axesScene); } catch (_) {}
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (container.contains(labelRenderer.domElement)) container.removeChild(labelRenderer.domElement);
    },
    toggleExplode,
    focusOnHardware,
    resetCamera,
    updateScreen: drawScreen,
    updateScreenTexture: drawScreen,
    setScreenState,
    setScreenSkin,
    getScreenSkin: () => screenSkinId,
    rotateKnob,
    loadModel,
    get currentKind() { return currentKind; },
  };
}
