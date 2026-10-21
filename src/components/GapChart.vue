<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, use, type ECharts } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ProjectionPoint } from '@/types'
import { formatCents, formatCentsWan } from '@/utils/format'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  series: ProjectionPoint[]
}>()

const container = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let observer: ResizeObserver | null = null

const COLORS = {
  gap: '#fb7185',
  pension: '#34d399',
  target: '#fbbf24',
  axis: '#64748b',
  split: 'rgba(148,163,184,0.08)',
}

function buildOption() {
  const points = props.series
  const ages = points.map((p) => `${p.age}岁`)
  const gap = points.map((p) => p.gap / 100)
  const pension = points.map((p) => p.pensionIncome / 100)
  const target = points.map((p) => p.targetExpense / 100)

  return {
    animationDuration: 500,
    grid: { left: 8, right: 14, top: 18, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,23,42,0.96)',
      borderColor: 'rgba(148,163,184,0.2)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(148,163,184,0.35)', type: 'dashed' },
      },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{
          dataIndex: number
        }>
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const row = (color: string, label: string, value: number) =>
          `<div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="width:7px;height:7px;border-radius:9999px;background:${color}"></span>
            <span style="color:#94a3b8">${label}</span>
            <span style="margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums">${formatCents(value * 100)}</span>
          </div>`
        return `<div style="font-weight:600;color:#f8fafc">${point.age} 岁 · 全年</div>
          ${row(COLORS.target, '目标支出', point.targetExpense)}
          ${row(COLORS.pension, '养老金', point.pensionIncome)}
          ${row(COLORS.gap, '缺口', point.gap)}
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.15);color:#94a3b8;font-size:11px">
            累计缺口 ${formatCents(point.cumulativeGap)}
          </div>`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ages,
      axisLine: { lineStyle: { color: COLORS.split } },
      axisTick: { show: false },
      axisLabel: {
        color: COLORS.axis,
        fontSize: 10,
        interval: 4,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: COLORS.split, type: 'dashed' } },
      axisLabel: {
        color: COLORS.axis,
        fontSize: 10,
        formatter: (value: number) => formatCentsWan(value * 100),
      },
    },
    series: [
      {
        name: '缺口',
        type: 'line',
        stack: 'total',
        smooth: 0.35,
        symbol: 'none',
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: 'rgba(251,113,133,0.22)' },
        emphasis: { disabled: true },
        data: gap,
      },
      {
        name: '养老金',
        type: 'line',
        stack: 'total',
        smooth: 0.35,
        symbol: 'none',
        lineStyle: { width: 1, color: 'rgba(52,211,153,0.7)' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(52,211,153,0.38)' },
              { offset: 1, color: 'rgba(52,211,153,0.06)' },
            ],
          },
        },
        data: pension,
      },
      {
        name: '目标支出',
        type: 'line',
        smooth: 0.35,
        symbol: 'none',
        lineStyle: { width: 1.5, color: COLORS.target, type: 'dashed' },
        data: target,
      },
    ],
  }
}

function render() {
  if (!chart) return
  chart.setOption(buildOption(), { notMerge: true })
}

onMounted(() => {
  if (!container.value) return
  chart = init(container.value, undefined, { renderer: 'canvas' })
  render()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(container.value)
})

watch(() => props.series, render, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="container" class="h-[260px] w-full sm:h-[300px]" role="img" aria-label="退休后养老金与目标支出缺口图" />
</template>
