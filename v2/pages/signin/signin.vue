<template>
  <view class="page">
    <view class="topbar">
      <view class="brand">
        <view class="logo"><text class="logo-text">签</text></view>
        <view class="brand-text">
          <text class="brand-name">课程签到</text>
          <text class="brand-sub">西安交通大学</text>
        </view>
      </view>
      <view class="user" @click="showUserMenu">
        <text class="user-name">{{ user.name || '同学' }}</text>
        <text class="user-role">{{ roleText }}</text>
      </view>
    </view>

    <view class="badge-mock" v-if="mockMode">
      <text class="badge-mock-text">离线演示</text>
    </view>

    <view class="content">
      <!-- 课程卡：课程与时间只读 -->
      <view class="course-card" v-if="course">
        <view class="course-head">
          <view class="pill">
            <text class="pill-text">{{ win.daysUntil > 0 ? '下一节课' : '当前课程' }}</text>
          </view>
          <text class="course-when">{{ weekdayLabel }} {{ course.startTime }}–{{ course.endTime }}</text>
        </view>
        <text class="course-name">{{ course.name }}</text>
        <view class="course-meta">
          <view class="meta">
            <text class="meta-key">教师</text>
            <text class="meta-val">{{ course.teacherName || '待分配' }}</text>
          </view>
          <view class="meta">
            <text class="meta-key">地点</text>
            <text class="meta-val">{{ course.locationName || '未设置' }}</text>
          </view>
          <view class="meta">
            <text class="meta-key">范围</text>
            <text class="meta-val">{{ course.radius }} 米</text>
          </view>
        </view>
      </view>

      <view class="course-card empty" v-else>
        <text class="empty-title">{{ loading ? '正在加载课程…' : '暂无可签到的课程' }}</text>
        <text class="empty-sub">请联系任课教师或教务管理员</text>
      </view>

      <!-- 倒计时 -->
      <view class="countdown">
        <text class="countdown-main">{{ countdown.main }}</text>
        <text class="countdown-sub">{{ countdown.sub }}</text>
      </view>

      <!-- 一个核心按钮 -->
      <view class="sign-area">
        <view class="ring" :class="btn.tone">
          <view class="btn" :class="[btn.tone, { disabled: !btn.enabled || submitting }]" @click="onSign">
            <text class="btn-text">{{ submitting ? '提交中' : btn.text }}</text>
            <text class="btn-sub">{{ submitting ? '请稍候' : btn.sub }}</text>
          </view>
        </view>
      </view>

      <!-- 定位状态 -->
      <view class="loc" :class="loc.tone">
        <view class="loc-dot"></view>
        <text class="loc-text">{{ loc.text }}</text>
        <text class="loc-action" v-if="loc.canRetry" @click="locate">重试</text>
        <text class="loc-action" v-if="loc.canDemo" @click="useDemoLocation">演示定位</text>
      </view>

      <view class="tips" v-if="tipText">
        <text class="tips-text">{{ tipText }}</text>
      </view>
    </view>

    <view class="footer">
      <view class="footer-item" @click="goRecords">
        <text class="footer-text">我的签到记录</text>
      </view>
      <view class="footer-split"></view>
      <view class="footer-item" @click="logout">
        <text class="footer-text">退出登录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api, isMockMode } from '../../common/request'
import { getUser, clearSession, isLoggedIn } from '../../common/session'
import { getLocation, locationErrorText, demoLocation, haversine } from '../../common/location'
import { windowText, buttonState, weekdayText, distanceText, getDeviceId } from '../../common/format'

export default {
  data() {
    return {
      loading: true,
      submitting: false,
      mockMode: false,
      user: {},
      course: null,
      win: { state: 'none' },
      signed: false,
      record: null,
      loc: {
        status: 'idle',
        tone: 'muted',
        text: '正在获取定位…',
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        distance: null,
        canRetry: false,
        canDemo: false
      },
      tipText: ''
    }
  },

  computed: {
    roleText() {
      const map = { student: '学生', teacher: '教师', admin: '管理员' }
      return map[this.user.role] || ''
    },
    weekdayLabel() {
      return this.course ? weekdayText(this.course.weekday) : ''
    },
    countdown() {
      return windowText(this.win, this.signed, this.record)
    },
    btn() {
      return buttonState(this.win, this.signed)
    }
  },

  onShow() {
    if (!isLoggedIn()) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.user = getUser() || {}
    this.mockMode = isMockMode()
    this.loadContext()
  },

  methods: {
    async loadContext() {
      this.loading = true
      try {
        const res = await api.signContext()
        this.course = res.course
        this.win = res.window || { state: 'none' }
        this.signed = !!res.signed
        this.record = res.record || null
        this.tipText = this.buildTip()
        this.mockMode = isMockMode()

        if (this.signed) {
          this.loc = {
            status: 'signed',
            tone: 'success',
            text: '本节课已完成签到，无需再次定位',
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            distance: this.record ? this.record.distance : null,
            canRetry: false,
            canDemo: false
          }
        } else if (this.course) {
          await this.locate()
        }
      } catch (e) {
        if (e.code === 401) {
          clearSession()
          uni.reLaunch({ url: '/pages/login/login' })
          return
        }
        this.course = null
        this.tipText = e.message || '加载失败，请下拉重试'
      } finally {
        this.loading = false
      }
    },

    buildTip() {
      if (this.signed) return ''
      if (this.win.state === 'before') {
        return `签到将在开课前 10 分钟自动开启，届时按钮会变亮。`
      }
      if (this.win.state === 'after') {
        return '本节签到已关闭。签到记录只能由管理员在后台查看。'
      }
      if (this.win.state === 'otherday' || this.win.state === 'none') {
        return '今天没有需要签到的课程。'
      }
      return ''
    },

    async locate() {
      if (!this.course) return
      this.loc = {
        status: 'loading',
        tone: 'muted',
        text: '正在获取当前位置…',
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        distance: null,
        canRetry: false,
        canDemo: false
      }

      try {
        const pos = await getLocation()
        this.applyPosition(pos, false)
      } catch (err) {
        this.loc = {
          status: 'fail',
          tone: 'danger',
          text: locationErrorText(err),
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          distance: null,
          canRetry: true,
          canDemo: true
        }
      }
    },

    useDemoLocation() {
      if (!this.course) return
      this.applyPosition(demoLocation(this.course), true)
    },

    /** 定位成功后只做展示用的距离预览，是否允许签到仍由云端裁决 */
    applyPosition(pos, isDemo) {
      const distance = haversine(pos.latitude, pos.longitude, this.course.latitude, this.course.longitude)
      const radius = Number(this.course.radius) || 50
      const inside = distance <= radius

      this.loc = {
        status: isDemo ? 'demo' : 'ok',
        tone: inside ? 'success' : 'warn',
        text: inside
          ? `${isDemo ? '演示定位' : '当前位置在签到范围内'} · 距点位 ${distanceText(distance)}`
          : `当前位置超出范围 · 距点位 ${distanceText(distance)}（允许 ${radius} 米）`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy || 0,
        distance,
        canRetry: !isDemo,
        canDemo: false
      }
    },

    async onSign() {
      if (this.submitting) return
      if (!this.btn.enabled) {
        uni.showToast({ title: this.btn.sub || '当前不可签到', icon: 'none' })
        return
      }
      if (!this.loc.latitude || !this.loc.longitude) {
        uni.showToast({ title: '请先获取定位', icon: 'none' })
        return
      }

      this.submitting = true
      try {
        const res = await api.signSubmit({
          courseId: this.course._id,
          latitude: this.loc.latitude,
          longitude: this.loc.longitude,
          accuracy: this.loc.accuracy,
          deviceId: getDeviceId()
        })

        this.signed = true
        this.record = {
          signTimeText: res.signTimeText,
          distance: res.distance,
          result: 'success'
        }
        uni.showToast({ title: '签到成功', icon: 'success', duration: 1600 })
      } catch (e) {
        if (e.code === 411) {
          this.signed = true
          this.record = {
            signTimeText: (e.data && e.data.signTimeText) || '',
            distance: e.data && e.data.distance
          }
          uni.showToast({ title: '本节课已签到', icon: 'none' })
        } else if (e.code === 410) {
          const d = (e.data && e.data.distance) || 0
          const r = (e.data && e.data.radius) || this.course.radius
          this.loc.tone = 'warn'
          this.loc.text = `当前位置超出范围 · 距点位 ${distanceText(d)}（允许 ${r} 米）`
          uni.showModal({
            title: '不在签到范围内',
            content: `你当前距离「${this.course.locationName || '签到点位'}」约 ${distanceText(
              d
            )}，允许范围 ${r} 米。\n\n请走到点位附近后重新定位。`,
            confirmText: '重新定位',
            cancelText: '知道了',
            success: (r2) => {
              if (r2.confirm) this.locate()
            }
          })
        } else if (e.code === 413) {
          uni.showModal({ title: '不在签到时间内', content: e.message, showCancel: false })
          this.loadContext()
        } else {
          uni.showModal({ title: '签到失败', content: e.message || '请稍后重试', showCancel: false })
        }
      } finally {
        this.submitting = false
      }
    },

    goRecords() {
      uni.navigateTo({ url: '/pages/records/records' })
    },

    showUserMenu() {
      uni.showActionSheet({
        itemList: ['我的签到记录', '退出登录'],
        success: (res) => {
          if (res.tapIndex === 0) this.goRecords()
          if (res.tapIndex === 1) this.logout()
        }
      })
    },

    logout() {
      uni.showModal({
        title: '退出登录',
        content: '退出后需要重新输入账号密码。',
        success: (res) => {
          if (!res.confirm) return
          clearSession()
          uni.reLaunch({ url: '/pages/login/login' })
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px 24px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #eef4ff 0%, #f5f7fb 36%, #f5f7fb 100%);
  position: relative;
}

.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.5px;
}

.brand-sub {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 1px;
}

.user {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #e8edf5;
  border-radius: 999px;
  padding: 5px 12px;
}

.user-name {
  font-size: 12.5px;
  color: #0f172a;
  font-weight: 500;
}

.user-role {
  font-size: 10px;
  color: #2563eb;
  background: #eaf1ff;
  border-radius: 999px;
  padding: 1px 6px;
}

.badge-mock {
  position: absolute;
  top: 62px;
  right: 20px;
  background: #fff5e6;
  border: 1px solid #ffe0b2;
  border-radius: 999px;
  padding: 3px 10px;
}

.badge-mock-text {
  font-size: 10px;
  color: #b54708;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.course-card {
  background: #fff;
  border-radius: 20px;
  padding: 18px 18px 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  margin-top: 12px;
}

.course-card.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 34px 18px;
}

.empty-title {
  font-size: 15px;
  color: #0f172a;
  font-weight: 600;
}

.empty-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
}

.course-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pill {
  background: #eaf1ff;
  border-radius: 999px;
  padding: 3px 10px;
}

.pill-text {
  font-size: 10.5px;
  color: #2563eb;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.course-when {
  font-size: 11.5px;
  color: #94a3b8;
}

.course-name {
  display: block;
  font-size: 23px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 10px;
  letter-spacing: 0.5px;
  line-height: 1.3;
}

.course-meta {
  display: flex;
  gap: 18px;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px dashed #edf1f7;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-key {
  font-size: 10px;
  color: #94a3b8;
}

.meta-val {
  font-size: 12.5px;
  color: #334155;
  font-weight: 500;
}

.countdown {
  text-align: center;
  margin: 26px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.countdown-main {
  font-size: 15px;
  color: #475569;
  letter-spacing: 0.3px;
}

.countdown-sub {
  font-size: 11.5px;
  color: #94a3b8;
}

.sign-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0 8px;
}

.ring {
  width: 226px;
  height: 226px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.ring.primary::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(37, 99, 235, 0.16);
}

.ring.primary::after {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  border: 1px solid rgba(37, 99, 235, 0.1);
}

.btn {
  width: 196px;
  height: 196px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: transform 0.12s ease, box-shadow 0.2s ease;
}

.btn.primary {
  background: linear-gradient(160deg, #4c8dff 0%, #2563eb 46%, #1d4ed8 100%);
  box-shadow: 0 22px 44px rgba(37, 99, 235, 0.32);
}

.btn.primary:active {
  transform: scale(0.975);
}

.btn.muted {
  background: linear-gradient(160deg, #e2e8f0, #cbd5e1);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
}

.btn.success {
  background: linear-gradient(160deg, #34d399, #12b76a);
  box-shadow: 0 18px 36px rgba(18, 183, 106, 0.26);
}

.btn.disabled {
  opacity: 0.9;
}

.btn-text {
  color: #fff;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 6px;
  margin-left: 6px;
}

.btn.muted .btn-text {
  color: #64748b;
}

.btn-sub {
  color: rgba(255, 255, 255, 0.78);
  font-size: 10.5px;
  letter-spacing: 0.5px;
}

.btn.muted .btn-sub {
  color: #94a3b8;
}

.loc {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 6px;
  padding: 0 6px;
}

.loc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
}

.loc.success .loc-dot {
  background: #12b76a;
  box-shadow: 0 0 0 3px rgba(18, 183, 106, 0.14);
}

.loc.warn .loc-dot {
  background: #f79009;
  box-shadow: 0 0 0 3px rgba(247, 144, 9, 0.14);
}

.loc.danger .loc-dot {
  background: #f04438;
  box-shadow: 0 0 0 3px rgba(240, 68, 56, 0.14);
}

.loc-text {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.5;
}

.loc.success .loc-text {
  color: #0f9d58;
}

.loc.warn .loc-text {
  color: #b54708;
}

.loc.danger .loc-text {
  color: #b42318;
}

.loc-action {
  font-size: 11.5px;
  color: #2563eb;
  font-weight: 500;
  padding-left: 4px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tips {
  margin-top: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid #edf1f7;
  border-radius: 12px;
}

.tips-text {
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.6;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 18px;
}

.footer-item {
  padding: 4px 2px;
}

.footer-text {
  font-size: 12px;
  color: #94a3b8;
}

.footer-split {
  width: 1px;
  height: 11px;
  background: #e2e8f0;
}
</style>
