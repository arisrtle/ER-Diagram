<template>
  <admin-shell title="概览" subtitle="今天的课程与签到情况" active="dashboard">
    <view class="stats">
      <view class="stat" v-for="s in cards" :key="s.key">
        <text class="stat-label">{{ s.label }}</text>
        <text class="stat-num">{{ s.value }}</text>
        <text class="stat-hint">{{ s.hint }}</text>
      </view>
    </view>

    <view class="grid">
      <view class="panel">
        <view class="panel-head">
          <text class="panel-title">今日课程</text>
          <text class="panel-more" @click="go('/pages/admin/schedule')">查看课表 ›</text>
        </view>

        <view class="today-list" v-if="todayCourses.length">
          <view class="today-item" v-for="c in todayCourses" :key="c._id">
            <view class="time-col">
              <text class="time-main">{{ c.startTime }}</text>
              <text class="time-sub">{{ c.endTime }}</text>
            </view>
            <view class="today-body">
              <text class="today-name">{{ c.name }}</text>
              <text class="today-meta">{{ c.teacherName }} · {{ c.locationName }} · {{ c.radius }} 米</text>
            </view>
            <view class="state" :class="stateOf(c).tone">
              <text class="state-text" :class="stateOf(c).tone">{{ stateOf(c).text }}</text>
            </view>
          </view>
        </view>

        <view class="empty" v-else>
          <text class="empty-text">今天没有安排课程</text>
        </view>
      </view>

      <view class="panel">
        <view class="panel-head">
          <text class="panel-title">最近签到</text>
          <text class="panel-more" @click="go('/pages/admin/records')">全部记录 ›</text>
        </view>

        <view class="recent" v-if="recent.length">
          <view class="recent-item" v-for="r in recent" :key="r._id">
            <view class="recent-avatar"><text class="recent-avatar-text">{{ (r.userName || '?').slice(0, 1) }}</text></view>
            <view class="recent-body">
              <text class="recent-name">{{ r.userName }}</text>
              <text class="recent-meta">{{ r.courseName }} · {{ r.signTimeText }}</text>
            </view>
            <text class="recent-distance">{{ Math.round(r.distance) }} 米</text>
          </view>
        </view>

        <view class="empty" v-else>
          <text class="empty-text">还没有签到记录</text>
        </view>
      </view>
    </view>

    <view class="quick">
      <view class="quick-item" @click="go('/pages/admin/courses')">
        <text class="quick-title">课程信息维护</text>
        <text class="quick-sub">新增课程、设置点位与距离阈值</text>
      </view>
      <view class="quick-item" @click="go('/pages/admin/teachers')">
        <text class="quick-title">教师分配</text>
        <text class="quick-sub">为课程指定授课教师</text>
      </view>
      <view class="quick-item" @click="go('/pages/admin/records')">
        <text class="quick-title">签到记录</text>
        <text class="quick-sub">筛选、导出 Excel、删除异常记录</text>
      </view>
    </view>
  </admin-shell>
</template>

<script>
import AdminShell from '../../components/AdminShell.vue'
import { api } from '../../common/request'
import { requireLogin, getUser } from '../../common/session'
import { parseHM, weekdayText } from '../../common/format'

export default {
  components: { AdminShell },

  data() {
    return {
      overview: {
        courseCount: 0,
        teacherCount: 0,
        studentCount: 0,
        todaySignCount: 0,
        recent: [],
        todayCourses: []
      },
      loading: true
    }
  },

  computed: {
    cards() {
      return [
        { key: 'c', label: '课程总数', value: this.overview.courseCount, hint: '含已停用' },
        { key: 't', label: '教师', value: this.overview.teacherCount, hint: '在册教师' },
        { key: 's', label: '学生', value: this.overview.studentCount, hint: '在册学生' },
        { key: 'r', label: '今日签到', value: this.overview.todaySignCount, hint: '人次' }
      ]
    },
    todayCourses() {
      return this.overview.todayCourses || []
    },
    recent() {
      return this.overview.recent || []
    }
  },

  onShow() {
    if (!requireLogin()) return
    const user = getUser() || {}
    if (user.role === 'student') {
      uni.reLaunch({ url: '/pages/signin/signin' })
      return
    }
    this.load()
  },

  methods: {
    weekdayText,

    async load() {
      this.loading = true
      try {
        this.overview = await api.overview()
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    /** 只用于展示的状态，真实判定在云端 */
    stateOf(c) {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const start = parseHM(c.startTime)
      const end = parseHM(c.endTime)
      if (!isFinite(start) || !isFinite(end)) return { text: '—', tone: 'gray' }
      if (nowMin < start - 10) return { text: '未开始', tone: 'gray' }
      if (nowMin > end + 10) return { text: '已结束', tone: 'gray' }
      return { text: '签到中', tone: 'green' }
    },

    go(url) {
      uni.reLaunch({ url })
    }
  }
}
</script>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
}

.stat-label {
  font-size: 11.5px;
  color: #94a3b8;
}

.stat-num {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.stat-hint {
  font-size: 10.5px;
  color: #cbd5e1;
}

.grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 14px;
}

.panel {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px 10px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
  min-height: 260px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #0f172a;
}

.panel-more {
  font-size: 11.5px;
  color: #2563eb;
  cursor: pointer;
}

.today-list {
  display: flex;
  flex-direction: column;
}

.today-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dashed #f1f5f9;
}

.today-item:last-child {
  border-bottom: none;
}

.time-col {
  width: 46px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.time-main {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.time-sub {
  font-size: 10px;
  color: #94a3b8;
}

.today-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.today-name {
  font-size: 13px;
  color: #0f172a;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.today-meta {
  font-size: 10.5px;
  color: #94a3b8;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.state {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  flex-shrink: 0;
}

.state.green {
  background: #e8f8f0;
}

.state-text {
  font-size: 10px;
  color: #64748b;
}

.state-text.green {
  color: #0f9d58;
}

.recent {
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px dashed #f1f5f9;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #eef4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.recent-avatar-text {
  font-size: 11px;
  color: #2563eb;
}

.recent-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.recent-name {
  font-size: 12.5px;
  color: #0f172a;
}

.recent-meta {
  font-size: 10px;
  color: #94a3b8;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.recent-distance {
  font-size: 10.5px;
  color: #94a3b8;
  flex-shrink: 0;
}

.empty {
  padding: 50px 0;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: #cbd5e1;
}

.quick {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 14px;
}

.quick-item {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.quick-item:hover {
  border-color: #dbeafe;
}

.quick-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.quick-sub {
  font-size: 10.5px;
  color: #94a3b8;
  line-height: 1.5;
}

@media (max-width: 1080px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .quick {
    grid-template-columns: 1fr;
  }
}
</style>
