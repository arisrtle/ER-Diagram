<template>
  <view class="page">
    <text class="logout" @click="onLogout">退出</text>

    <view class="top">
      <text class="label">当前课程</text>
      <text class="course">{{ courseName }}</text>
      <text class="time">{{ countdownText || ' ' }}</text>
    </view>

    <view class="center">
      <button
        class="circle"
        :class="{ disabled: buttonDisabled, ready: state === 'ready' }"
        :disabled="buttonDisabled"
        @click="onPrimary"
      >
        {{ buttonText }}
      </button>
    </view>

    <view class="bottom">
      <view class="dot" :class="hintClass"></view>
      <view class="hint-wrap">
        <text class="hint" :class="hintClass">{{ hintText }}</text>
        <text v-if="state === 'error'" class="location-help">
          请允许定位权限；手机需开启定位服务；微信内请点右上角“在浏览器打开”
        </text>
      </view>
    </view>

    <view v-if="successVisible" class="success-mask">
      <view class="success-card">
        <view class="success-icon">✓</view>
        <text class="success-title">签到成功</text>
        <text class="success-time">{{ successTime }}</text>
        <button class="success-btn" @click="closeSuccess">完成</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getToken, clearAuth } from '../../common/auth'
import { resetMockCheckin } from '../../common/mock'
import * as api from '../../common/api'
import { haversine, formatClock } from '../../common/geo'

const state = ref('loading')
const session = ref(null)
const location = ref(null)
const distance = ref(null)
const hintText = ref('正在加载当前课程...')
const countdownText = ref('')
const successVisible = ref(false)
const successTime = ref('')
let timer = null

const courseName = computed(() => (session.value && session.value.course_name) || '—')

const buttonText = computed(() => {
  const map = {
    loading: '加载中',
    'no-session': '刷新',
    'not-open': '未开放',
    locating: '定位中',
    'out-of-range': '重新定位',
    ready: '签到',
    checking: '签到中',
    success: '已签到',
    already: '已签到',
    error: '重试'
  }
  return map[state.value] || '签到'
})

const buttonDisabled = computed(() =>
  ['loading', 'not-open', 'locating', 'checking', 'success', 'already'].includes(state.value)
)

const hintClass = computed(() => {
  if (state.value === 'ready') return 'green'
  if (state.value === 'out-of-range') return 'orange'
  return 'gray'
})

onLoad(() => {
  if (!getToken()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  loadSession()
})

onShow(() => {
  if (session.value) startTimer()
})

onHide(() => stopTimer())
onUnload(() => stopTimer())

async function loadSession() {
  state.value = 'loading'
  hintText.value = '正在加载当前课程...'
  try {
    const res = await api.getCurrentSession()
    if (!res) {
      session.value = null
      state.value = 'no-session'
      hintText.value = '当前没有待签到课程'
      return
    }
    session.value = res
    startTimer()
    if (res.already_checked_in) {
      state.value = 'already'
      hintText.value = '本节课已完成签到'
      return
    }
    if (res.checkin_status !== 'open') {
      state.value = 'not-open'
      hintText.value = '签到尚未开放，请等待老师开启'
      return
    }
    state.value = 'locating'
    hintText.value = '正在获取你的位置...'
    await refreshLocation()
  } catch (e) {
    if (handleAuthError(e)) return
    state.value = 'error'
    hintText.value = e.message || '加载失败，请重试'
  }
}

function handleAuthError(e) {
  if (e && e.statusCode === 401) {
    clearAuth()
    uni.reLaunch({ url: '/pages/login/login' })
    return true
  }
  return false
}

async function refreshLocation() {
  try {
    let loc
    try {
      loc = await getLocation()
    } catch (e) {
      if (!api.MOCK_FALLBACK_LOCATION) throw e
      // mock 模式：浏览器拒绝定位时，用模拟位置继续演示
      loc = {
        latitude: session.value.latitude,
        longitude: session.value.longitude,
        accuracy: 0
      }
    }
    location.value = loc
    if (api.USE_MOCK && session.value) {
      // mock 模式下把签到点放在用户附近，方便在任意地点演示
      session.value.latitude = loc.latitude - 0.0001
      session.value.longitude = loc.longitude - 0.0001
    }
    if (!session.value || session.value.latitude == null || session.value.longitude == null) {
      state.value = 'error'
      hintText.value = '本节课尚未设置签到点'
      return
    }
    const d = haversine(loc, {
      latitude: session.value.latitude,
      longitude: session.value.longitude
    })
    distance.value = d
    if (d <= session.value.distance_limit) {
      state.value = 'ready'
      hintText.value = '当前位置在签到范围内'
    } else {
      state.value = 'out-of-range'
      hintText.value = `距离签到点 ${Math.round(d)} 米，超出 ${session.value.distance_limit} 米范围`
    }
  } catch (e) {
    state.value = 'error'
    hintText.value = e.message || '定位失败，请重试'
  }
}

function getLocation() {
  // #ifdef H5
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0
        })
      },
      (error) => {
        const messages = {
          1: '定位权限被拒绝，请在浏览器设置中允许定位',
          2: '定位不可用，请检查手机定位服务或网络',
          3: '定位超时，请到开阔处重试'
        }
        reject(new Error(messages[error.code] || error.message || '定位失败'))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  })
  // #endif

  // #ifndef H5
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy || 0
        })
      },
      fail: (error) => {
        reject(
          new Error(
            error && error.errMsg
              ? `定位失败：${error.errMsg}`
              : '定位失败，请允许定位权限后重试'
          )
        )
      }
    })
  })
  // #endif
}

async function onPrimary() {
  if (buttonDisabled.value) return
  if (state.value === 'no-session') {
    loadSession()
    return
  }
  if (state.value === 'out-of-range' || state.value === 'error') {
    state.value = 'locating'
    hintText.value = '正在重新定位...'
    await refreshLocation()
    return
  }
  if (state.value === 'ready') {
    await doCheckin()
  }
}

async function doCheckin() {
  state.value = 'checking'
  hintText.value = '正在提交签到...'
  try {
    const res = await api.checkin(session.value.session_id, location.value)
    if (res.success) {
      state.value = 'success'
      successTime.value = formatClock(new Date())
      successVisible.value = true
      hintText.value = '签到成功'
      return
    }
    if (res.code === 'already') {
      state.value = 'already'
      hintText.value = '本节课已完成签到'
      return
    }
    state.value = 'ready'
    hintText.value = res.message || '签到失败，请重试'
    uni.showToast({ title: hintText.value, icon: 'none' })
  } catch (e) {
    if (handleAuthError(e)) return
    state.value = 'ready'
    hintText.value = e.message || '签到失败，请重试'
    uni.showToast({ title: hintText.value, icon: 'none' })
  }
}

function closeSuccess() {
  successVisible.value = false
}

function onLogout() {
  clearAuth()
  resetMockCheckin()
  uni.reLaunch({ url: '/pages/login/login' })
}

function startTimer() {
  stopTimer()
  updateCountdown()
  timer = setInterval(updateCountdown, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function updateCountdown() {
  const s = session.value
  if (!s || !s.start_time) {
    countdownText.value = s && s.checkin_status === 'open' ? '签到已开放' : ''
    return
  }
  const now = new Date()
  const [h, m] = s.start_time.split(':').map(Number)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  const diff = start.getTime() - now.getTime()
  if (diff > 0) {
    const mins = Math.ceil(diff / 60000)
    countdownText.value = mins <= 1 ? '即将开始' : `距离开课还有 ${mins} 分钟`
  } else {
    countdownText.value = '签到进行中'
  }
}
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: calc(var(--status-bar-height, 0px) + 50rpx) 48rpx 60rpx;
  background: linear-gradient(180deg, #f2f7ff 0%, #ffffff 58%);
}

.logout {
  position: absolute;
  top: calc(var(--status-bar-height, 0px) + 20rpx);
  right: 40rpx;
  z-index: 5;
  padding: 8rpx 16rpx;
  font-size: 24rpx;
  color: #8d99ad;
}

.top {
  padding-top: 30rpx;
  text-align: center;
}

.label {
  display: block;
  font-size: 26rpx;
  letter-spacing: 4rpx;
  color: #8d99ad;
}

.course {
  display: block;
  margin-top: 20rpx;
  font-size: 50rpx;
  font-weight: 700;
  line-height: 1.3;
  color: #14213a;
}

.time {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  color: #6b7a90;
}

.center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0;
}

.circle {
  width: 360rpx;
  height: 360rpx;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: linear-gradient(145deg, #4a90ff 0%, #1f66e0 100%);
  box-shadow: 0 24rpx 60rpx rgba(31, 102, 224, 0.28);
  color: #ffffff;
  font-size: 56rpx;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle::after {
  border: none;
}

.circle.ready {
  box-shadow: 0 24rpx 70rpx rgba(31, 102, 224, 0.42);
}

.circle.disabled {
  background: linear-gradient(145deg, #a9bdd8 0%, #8fa6c4 100%);
  box-shadow: none;
  opacity: 0.85;
}

.bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0 50rpx;
}

.dot {
  width: 14rpx;
  height: 14rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #9aa6b8;
}

.dot.green {
  background: #20b26b;
}

.dot.orange {
  background: #e58a2b;
}

.hint-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.hint {
  font-size: 26rpx;
  color: #6b7a90;
}

.location-help {
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: #9aa6b8;
}

.hint.green {
  color: #1f9d62;
}

.hint.orange {
  color: #cf761c;
}

.success-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 25, 40, 0.45);
}

.success-card {
  width: 520rpx;
  padding: 56rpx 40rpx 40rpx;
  border-radius: 32rpx;
  background: #ffffff;
  text-align: center;
}

.success-icon {
  width: 120rpx;
  height: 120rpx;
  margin: 0 auto 24rpx;
  border-radius: 50%;
  background: #e8f8ef;
  color: #20b26b;
  font-size: 64rpx;
  line-height: 120rpx;
}

.success-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: #14213a;
}

.success-time {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #7a879a;
}

.success-btn {
  margin-top: 36rpx;
  border: none;
  border-radius: 44rpx;
  background: #1f66e0;
  color: #ffffff;
  font-size: 30rpx;
}

.success-btn::after {
  border: none;
}
</style>
