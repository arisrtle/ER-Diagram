<template>
  <view class="page">
    <view class="nav">
      <view class="back" @click="goBack"><text class="back-icon">‹</text></view>
      <text class="nav-title">我的签到记录</text>
      <view class="back placeholder"></view>
    </view>

    <view class="summary">
      <view class="summary-item">
        <text class="summary-num">{{ list.length }}</text>
        <text class="summary-label">累计签到</text>
      </view>
      <view class="summary-split"></view>
      <view class="summary-item">
        <text class="summary-num">{{ courseCount }}</text>
        <text class="summary-label">涉及课程</text>
      </view>
    </view>

    <view class="list" v-if="list.length">
      <view class="item" v-for="r in list" :key="r._id">
        <view class="date-col">
          <text class="date-day">{{ dayOf(r.sessionDate) }}</text>
          <text class="date-month">{{ monthOf(r.sessionDate) }}</text>
        </view>
        <view class="body">
          <view class="body-head">
            <text class="course">{{ r.courseName }}</text>
            <view class="tag-ok"><text class="tag-ok-text">已签到</text></view>
          </view>
          <text class="line">{{ r.teacherName || '—' }} · {{ r.signTimeText }}</text>
          <text class="line muted">距点位 {{ distanceText(r.distance) }}</text>
        </view>
      </view>
    </view>

    <view class="empty" v-else-if="!loading">
      <view class="empty-icon">◷</view>
      <text class="empty-title">还没有签到记录</text>
      <text class="empty-sub">在签到时间内到达课程点位即可签到</text>
    </view>

    <view class="loading" v-if="loading">
      <text class="loading-text">加载中…</text>
    </view>
  </view>
</template>

<script>
import { api } from '../../common/request'
import { requireLogin } from '../../common/session'
import { distanceText } from '../../common/format'

export default {
  data() {
    return {
      loading: true,
      list: []
    }
  },

  computed: {
    courseCount() {
      const set = {}
      this.list.forEach((r) => {
        set[r.courseId] = 1
      })
      return Object.keys(set).length
    }
  },

  onShow() {
    if (!requireLogin()) return
    this.load()
  },

  methods: {
    distanceText,

    async load() {
      this.loading = true
      try {
        this.list = (await api.recordMine()) || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    dayOf(date) {
      return date ? String(date).slice(8, 10) : '--'
    },

    monthOf(date) {
      return date ? String(date).slice(5, 7) + ' 月' : ''
    },

    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.reLaunch({ url: '/pages/signin/signin' })
      }
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px 30px;
  background: #f5f7fb;
}

.nav {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}

.back {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.back.placeholder {
  background: transparent;
  box-shadow: none;
}

.back-icon {
  font-size: 22px;
  color: #334155;
  line-height: 1;
  margin-top: -2px;
}

.nav-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.summary {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 18px;
  padding: 18px 0;
  margin-top: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.summary-num {
  font-size: 24px;
  font-weight: 700;
  color: #2563eb;
  letter-spacing: 0.5px;
}

.summary-label {
  font-size: 11px;
  color: #94a3b8;
}

.summary-split {
  width: 1px;
  height: 28px;
  background: #edf1f7;
}

.list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  display: flex;
  gap: 14px;
  background: #fff;
  border-radius: 16px;
  padding: 15px 16px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.date-col {
  width: 46px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-right: 1px dashed #edf1f7;
  padding-right: 10px;
}

.date-day {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
}

.date-month {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.body-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.course {
  font-size: 14.5px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tag-ok {
  background: #e8f8f0;
  border-radius: 999px;
  padding: 2px 8px;
  flex-shrink: 0;
}

.tag-ok-text {
  font-size: 10px;
  color: #0f9d58;
}

.line {
  font-size: 11.5px;
  color: #64748b;
}

.line.muted {
  color: #94a3b8;
}

.empty {
  margin-top: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 34px;
  color: #cbd5e1;
}

.empty-title {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.empty-sub {
  font-size: 11.5px;
  color: #94a3b8;
}

.loading {
  margin-top: 40px;
  text-align: center;
}

.loading-text {
  font-size: 12px;
  color: #94a3b8;
}
</style>
