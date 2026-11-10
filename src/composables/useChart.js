import { ref, nextTick } from 'vue';
import * as echarts from 'echarts';

/**
 * ECharts 折线封装（ChartModal 专用）
 *
 * 【调用】openChart → updateChart（深监听 history）→ closeChart 必须 dispose。
 * 【坑】弹窗 CSS 动画期间宽高可能为 0，故 open 后 50/200ms 再 resize。
 */
export function useChart() {
  const echartRef = ref(null);
  let myChart = null;

  const buildOption = (colorHex, history, unit = '') => {
    const u = String(unit || '').trim();
    const fmt = (v) => (v == null || v === '' ? '-' : `${v}${u ? ' ' + u : ''}`);
    const times = history?.times?.length ? [...history.times] : [];
    const data = history?.data?.length ? [...history.data] : [];
    const empty = times.length === 0;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20,20,20,0.8)',
        borderColor: colorHex,
        textStyle: { color: '#fff' },
        valueFormatter: (v) => fmt(v),
      },
      grid: { left: '5%', right: '5%', bottom: '12%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: empty ? ['等待上报'] : times,
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: {
          color: '#aaa',
          interval: times.length > 24 ? Math.floor(times.length / 12) : 0,
          rotate: times.length > 16 ? 30 : 0,
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { color: '#222', type: 'dashed' } },
        name: u,
        nameTextStyle: { color: '#aaa' },
        axisLabel: { color: '#aaa', formatter: (v) => (u ? `${v}${u}` : `${v}`) },
      },
      series: [{
        data: empty ? [0] : data,
        type: 'line',
        smooth: true,
        showSymbol: data.length <= 60,
        symbol: 'circle',
        symbolSize: 6,
        label: {
          show: !empty && data.length <= 20,
          position: 'top',
          color: '#5a6b70',
          fontSize: 10,
          formatter: (p) => fmt(p.value),
        },
        itemStyle: { color: colorHex },
        lineStyle: { width: 3, color: colorHex, shadowBlur: 8, shadowColor: colorHex },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: (colorHex || '#3b82f6') + '99' },
            { offset: 1, color: 'rgba(0,0,0,0)' },
          ]),
        },
      }],
    };
  };

  const openChart = async ({ color = '#3b82f6', history = { times: [], data: [] }, unit = '' }) => {
    await nextTick();
    await nextTick();

    if (!echartRef.value) return;

    if (myChart) {
      myChart.dispose();
      myChart = null;
    }
    myChart = echarts.init(echartRef.value);
    myChart.setOption(buildOption(color, history, unit));

    // 弹窗动画后再 resize，避免宽高为 0 导致空白
    setTimeout(() => {
      if (myChart) myChart.resize();
    }, 50);
    setTimeout(() => {
      if (myChart) myChart.resize();
    }, 200);
  };

  /** 图表已打开时刷新数据（不销毁实例） */
  const updateChart = (history, colorHex = '#3b82f6', unit = '') => {
    if (!myChart) return;
    myChart.setOption(buildOption(colorHex, history, unit), { notMerge: false });
    myChart.resize();
  };

  const closeChart = () => {
    if (myChart) {
      myChart.dispose();
      myChart = null;
    }
  };

  const handleResize = () => {
    if (myChart) myChart.resize();
  };

  return { echartRef, openChart, updateChart, closeChart, handleResize };
}
