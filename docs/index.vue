<template>
  <div ref="div" class="w-full h-[calc(100vh-64px)] bg-white" />
</template>

<script lang="ts" setup>
import { Map, TextLayer, LineLayer, FillLayer } from 'mapo.js'
import { ref, onMounted, onUnmounted } from 'vue'

const div = ref()
let map

onMounted(() => {
  map = new Map({
    container: div.value,
    center: [116.405285, 39.904989],
    zoom: 2.5,
    fps: true
  })
  const textLayer = new TextLayer({
    source: [{ type: 'Feature', properties: { name: '北京市' }, geometry: { type: 'Point', coordinates: [116.405285, 39.904989] } }, { type: 'Feature', properties: { name: '天津市' }, geometry: { type: 'Point', coordinates: [117.190182, 39.125596] } }, { type: 'Feature', properties: { name: '河北省' }, geometry: { type: 'Point', coordinates: [114.502461, 38.045474] } }, { type: 'Feature', properties: { name: '山西省' }, geometry: { type: 'Point', coordinates: [112.549248, 37.857014] } }, { type: 'Feature', properties: { name: '内蒙古自治区' }, geometry: { type: 'Point', coordinates: [111.670801, 40.818311] } }, { type: 'Feature', properties: { name: '辽宁省' }, geometry: { type: 'Point', coordinates: [123.429096, 41.796767] } }, { type: 'Feature', properties: { name: '吉林省' }, geometry: { type: 'Point', coordinates: [125.3245, 43.886841] } }, { type: 'Feature', properties: { name: '黑龙江省' }, geometry: { type: 'Point', coordinates: [126.642464, 45.756967] } }, { type: 'Feature', properties: { name: '上海市' }, geometry: { type: 'Point', coordinates: [121.472644, 31.231706] } }, { type: 'Feature', properties: { name: '江苏省' }, geometry: { type: 'Point', coordinates: [118.767413, 32.041544] } }, { type: 'Feature', properties: { name: '浙江省' }, geometry: { type: 'Point', coordinates: [120.153576, 30.287459] } }, { type: 'Feature', properties: { name: '安徽省' }, geometry: { type: 'Point', coordinates: [117.283042, 31.86119] } }, { type: 'Feature', properties: { name: '福建省' }, geometry: { type: 'Point', coordinates: [119.306239, 26.075302] } }, { type: 'Feature', properties: { name: '江西省' }, geometry: { type: 'Point', coordinates: [115.892151, 28.676493] } }, { type: 'Feature', properties: { name: '山东省' }, geometry: { type: 'Point', coordinates: [117.000923, 36.675807] } }, { type: 'Feature', properties: { name: '河南省' }, geometry: { type: 'Point', coordinates: [113.665412, 34.757975] } }, { type: 'Feature', properties: { name: '湖北省' }, geometry: { type: 'Point', coordinates: [114.298572, 30.584355] } }, { type: 'Feature', properties: { name: '湖南省' }, geometry: { type: 'Point', coordinates: [112.982279, 28.19409] } }, { type: 'Feature', properties: { name: '广东省' }, geometry: { type: 'Point', coordinates: [113.280637, 23.125178] } }, { type: 'Feature', properties: { name: '广西壮族自治区' }, geometry: { type: 'Point', coordinates: [108.320004, 22.82402] } }, { type: 'Feature', properties: { name: '海南省' }, geometry: { type: 'Point', coordinates: [110.33119, 20.031971] } }, { type: 'Feature', properties: { name: '重庆市' }, geometry: { type: 'Point', coordinates: [106.504962, 29.533155] } }, { type: 'Feature', properties: { name: '四川省' }, geometry: { type: 'Point', coordinates: [104.065735, 30.659462] } }, { type: 'Feature', properties: { name: '贵州省' }, geometry: { type: 'Point', coordinates: [106.713478, 26.578343] } }, { type: 'Feature', properties: { name: '云南省' }, geometry: { type: 'Point', coordinates: [102.712251, 25.040609] } }, { type: 'Feature', properties: { name: '西藏自治区' }, geometry: { type: 'Point', coordinates: [91.132212, 29.660361] } }, { type: 'Feature', properties: { name: '陕西省' }, geometry: { type: 'Point', coordinates: [108.948024, 34.263161] } }, { type: 'Feature', properties: { name: '甘肃省' }, geometry: { type: 'Point', coordinates: [103.823557, 36.058039] } }, { type: 'Feature', properties: { name: '青海省' }, geometry: { type: 'Point', coordinates: [101.778916, 36.623178] } }, { type: 'Feature', properties: { name: '宁夏回族自治区' }, geometry: { type: 'Point', coordinates: [106.278179, 38.46637] } }, { type: 'Feature', properties: { name: '新疆维吾尔自治区' }, geometry: { type: 'Point', coordinates: [87.617733, 43.792818] } }, { type: 'Feature', properties: { name: '台湾省' }, geometry: { type: 'Point', coordinates: [121.509062, 25.044332] } }, { type: 'Feature', properties: { name: '香港特别行政区' }, geometry: { type: 'Point', coordinates: [114.173355, 22.320048] } }, { type: 'Feature', properties: { name: '澳门特别行政区' }, geometry: { type: 'Point', coordinates: [113.54909, 22.198951] } }, { type: 'Feature', properties: { name: '测试' }, geometry: { type: 'Point', coordinates: [90, 85] } }, { type: 'Feature', properties: { name: '测试' }, geometry: { type: 'Point', coordinates: [-90, -85] } }]
  })
  map.addLayer(textLayer)

  const lineLayer = new LineLayer({
    source: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, -90],
            [90, 90],
            [180, -90],
          ]
        }
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [80, 0],
            [100, 40],
          ]
        }
      },
    ]
  })
  map.addLayer(lineLayer)

  const fillLayer = new FillLayer({
    source: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [100, 40],
            [120, 30],
            [90, 60],
            [100, 40],
          ]]
        }
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [90, 20],
            [100, 30],
            [80, 40],
            [90, 20],
          ]]
        }
      },
    ]
  })
  map.addLayer(fillLayer)
})

onUnmounted(() => {
  console.log('onUnmounted')
  map?.dispose()
})
</script>