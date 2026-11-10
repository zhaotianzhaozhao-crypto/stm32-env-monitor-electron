/**
 * 传感器历史 → Excel（.xlsx）
 *
 * 【数据表】时间 / ISO / 温度℃ / 湿度% / AQI
 * 【图表表】echarts 离屏生成温/湿/AQI 折线 PNG，嵌入工作簿
 * 【触发】Blob + <a download>；文件名 奶家人-传感器历史-YYYYMMDD-HHmmss.xlsx
 */
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import * as echarts from 'echarts';

const SERIES = [
  { key: 'temp', title: '温度', unit: '℃', color: '#FF9500', col: '温度℃' },
  { key: 'humidity', title: '湿度', unit: '%', color: '#007AFF', col: '湿度%' },
  { key: 'aqi', title: '空气质量', unit: 'AQI', color: '#AF52DE', col: '空气质量AQI' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function stampLocal(d = new Date()) {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

function buildChartOption(colorHex, times, data, title) {
  const empty = !times?.length;
  return {
    backgroundColor: '#ffffff',
    title: {
      text: title,
      left: 'center',
      textStyle: { color: '#111113', fontSize: 14, fontWeight: 650 },
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '6%', right: '4%', bottom: '14%', top: '18%', containLabel: true },
    xAxis: {
      type: 'category',
      data: empty ? ['无数据'] : times,
      axisLine: { lineStyle: { color: '#c7c7cc' } },
      axisLabel: {
        color: '#636366',
        interval: times.length > 24 ? Math.floor(times.length / 12) : 0,
        rotate: times.length > 16 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { color: '#e5e5ea', type: 'dashed' } },
      axisLabel: { color: '#636366' },
    },
    series: [
      {
        name: title,
        type: 'line',
        smooth: true,
        showSymbol: (data?.length || 0) <= 60,
        symbol: 'circle',
        symbolSize: 5,
        data: empty ? [0] : data,
        itemStyle: { color: colorHex },
        lineStyle: { width: 2.5, color: colorHex },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${colorHex}66` },
            { offset: 1, color: `${colorHex}00` },
          ]),
        },
      },
    ],
  };
}

/**
 * 离屏渲染一条折线，返回 PNG dataURL；务必 dispose 防泄漏
 */
function renderSeriesPng(times, data, color, title, width = 900, height = 320) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(host);

  let chart = null;
  try {
    chart = echarts.init(host, null, { renderer: 'canvas', width, height });
    chart.setOption(buildChartOption(color, times, data, title), { notMerge: true });
    // 同步一帧，确保 canvas 已画完
    const url = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    return url;
  } finally {
    if (chart) {
      chart.dispose();
      chart = null;
    }
    host.remove();
  }
}

function dataUrlToBase64(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/\w+;base64,(.+)$/);
  return m ? m[1] : '';
}

function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 稍后释放，避免部分内核还没开始下载
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * @param {{ times: string[], timestamps?: number[], temp: (number|null)[], humidity: (number|null)[], aqi: (number|null)[] } | { rows: object[] }} seriesOrRows
 * @returns {Promise<{ filename: string, rowCount: number }>}
 */
export async function exportSensorHistoryExcel(input) {
  const rows = Array.isArray(input?.rows)
    ? input.rows
    : (() => {
        const times = input?.times || [];
        const timestamps = input?.timestamps || [];
        const temp = input?.temp || [];
        const humidity = input?.humidity || [];
        const aqi = input?.aqi || [];
        const out = [];
        for (let i = 0; i < times.length; i++) {
          const ts = timestamps[i];
          let iso = '';
          if (ts != null && Number.isFinite(Number(ts))) {
            try {
              iso = new Date(Number(ts)).toISOString();
            } catch {
              iso = '';
            }
          }
          out.push({
            time: times[i] ?? '',
            iso,
            temp: temp[i] ?? null,
            humidity: humidity[i] ?? null,
            aqi: aqi[i] ?? null,
          });
        }
        return out;
      })();

  if (!rows.length) {
    const err = new Error('暂无历史数据');
    err.code = 'EMPTY';
    throw err;
  }

  const times = rows.map((r) => r.time);
  const seriesData = {
    temp: rows.map((r) => r.temp),
    humidity: rows.map((r) => r.humidity),
    aqi: rows.map((r) => r.aqi),
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '奶家人';
  workbook.created = new Date();
  workbook.modified = new Date();

  // —— 数据表 ——
  const dataSheet = workbook.addWorksheet('传感器数据', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  dataSheet.columns = [
    { header: '时间', key: 'time', width: 12 },
    { header: '时间戳ISO', key: 'iso', width: 26 },
    { header: '温度℃', key: 'temp', width: 12 },
    { header: '湿度%', key: 'humidity', width: 12 },
    { header: '空气质量AQI', key: 'aqi', width: 14 },
  ];
  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF111113' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F1FF' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const r of rows) {
    dataSheet.addRow({
      time: r.time,
      iso: r.iso,
      temp: r.temp,
      humidity: r.humidity,
      aqi: r.aqi,
    });
  }

  // —— 图表表 ——
  const chartSheet = workbook.addWorksheet('趋势图表');
  chartSheet.getCell('A1').value = `奶家人传感器趋势（共 ${rows.length} 点）`;
  chartSheet.getCell('A1').font = { bold: true, size: 14 };
  chartSheet.getColumn(1).width = 20;

  let rowCursor = 3; // 1-based excel row for image top
  for (const s of SERIES) {
    const title = `${s.title}趋势（${s.unit}）`;
    const png = renderSeriesPng(times, seriesData[s.key], s.color, title);
    const b64 = dataUrlToBase64(png);
    if (!b64) continue;

    const imageId = workbook.addImage({
      base64: b64,
      extension: 'png',
    });
    // 约 900×320 @2x → 显示宽高
    chartSheet.addImage(imageId, {
      tl: { col: 0, row: rowCursor - 1 },
      ext: { width: 900, height: 320 },
      editAs: 'oneCell',
    });
    chartSheet.getCell(`A${rowCursor}`).value = title;
    rowCursor += 18; // 约 320px / 18px ≈ 17–18 行
  }

  const filename = `奶家人-传感器历史-${stampLocal()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, filename);

  return { filename, rowCount: rows.length };
}