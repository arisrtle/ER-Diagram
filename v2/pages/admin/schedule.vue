<template>
  <admin-shell
    title="课程安排"
    subtitle="周课表视图 · 一门课每周固定时间，签到按「课次日期」去重"
    active="schedule"
  >
    <view class="bar">
      <view class="bar-left">
        <text class="bar-title">本周课表</text>
        <text class="bar-sub">共 {{ list.length }} 门课 · 签到窗口为开课前 10 分钟至下课后 10 分钟</text>
      </view>
      <view class="legend">
        <view class="legend-item"><view class="dot on"></view><text class="legend-text">今天</text></view>
        <view class="legend-item"><view class="dot"></view><text class="legend-text">其他</text></view>
      </view>
    </view>

    <view class="board-wrap">
      <view class="board">
        <view class="col" v-for="(day, i) in days" :key="i" :class="{ today: day.weekday === todayWeekday }">
          <view class="col-head">
            <text class="day-name" :class="{ today: day.weekday === todayWeekday }">{{ day.label }}</text>
            <text class="day-count">{{ day.courses.length }} 节</text>
          </view>

          <view class="col-body">
            <view class="slot" v-for="c in day.courses" :key="c._id" @click="edit(c)">
              <text class="slot-time">{{ c.startTime }}</text>
              <text class="slot-name">{{ c.name }}</text>
              <text class="slot-meta">{{ c.teacherName || '未分配' }}</text>
              <text class="slot-meta light">{{ c.locationName || '未设点位' }}</text>
              <view class="slot-foot">
                <text class="slot-radius">{{ c.radius }} 米</text>
                <text class="slot-status" v-if="c.status === 0">已停用</text>
              </view>
            </view>

            <view class="slot-empty" v-if="!day.courses.length">
              <text class="slot-empty-text">无课</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="note">
      <text class="note-title">关于「三张表」怎么装下课表</text>
      <text class="note-text">
        课程表里存的是「星期几 + 起止时间」，一门课每周固定重复，不额外建课次表。
        每次上课对应一个课次日期（sessionDate），签到记录的唯一键是
        「用户 + 课程 + 课次日期」，所以同一个人每周都能签，但同一节课只能签一次。
      </text>
    </view>
  </admin-shell>
</template>

<script>
import AdminShell from '../../components/AdminShell.vue'
import { api } from '../../common/request'
import { requireLogin, getUser } from '../../common/session'

export default {
  components: { AdminShell },

  data() {
    return {
      list: [],
      loading: true
    }
  },

  computed: {
    todayWeekday() {
      const d = new Date().getDay()
      return d === 0 ? 7 : d
    },
    days() {
      const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      return labels.map((label, i) => ({
        label,
        weekday: i + 1,
        courses: this.list
          .filter((c) => Number(c.weekday) === i + 1)
          .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
      }))
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
    async load() {
      this.loading = true
      try {
        this.list = (await api.courseList('all')) || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    edit(c) {
      uni.reLaunch({ url: '/pages/admin/courses' })
    }
  }
}
</script>

<style scoped>
.bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 16px;
}

.bar-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bar-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #0f172a;
}

.bar-sub {
  font-size: 11px;
  color: #94a3b8;
}

.legend {
  display: flex;
  gap: 14px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cbd5e1;
}

.dot.on {
  background: #2563eb;
}

.legend-text {
  font-size: 10.5px;
  color: #94a3b8;
}

.board-wrap {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
  overflow-x: auto;
}

.board {
  display: grid;
  grid-template-columns: repeat(7, minmax(118px, 1fr));
  gap: 8px;
  min-width: 860px;
}

.col {
  background: #fafbfd;
  border: 1px solid #f1f5f9;
  border-radius: 11px;
  padding: 10px 9px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.col.today {
  background: #f7faff;
  border-color: #dbeafe;
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 8px;
  border-bottom: 1px solid #eef2f7;
  margin-bottom: 8px;
}

.day-name {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.day-name.today {
  color: #1d4ed8;
}

.day-count {
  font-size: 10px;
  color: #b6c0cf;
}

.col-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.slot {
  background: #fff;
  border: 1px solid #edf1f7;
  border-left: 3px solid #3b82f6;
  border-radius: 8px;
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.12s;
}

.slot:hover {
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.slot-time {
  font-size: 10px;
  color: #2563eb;
  font-weight: 600;
}

.slot-name {
  font-size: 12px;
  color: #0f172a;
  font-weight: 600;
  line-height: 1.35;
}

.slot-meta {
  font-size: 10px;
  color: #64748b;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.slot-meta.light {
  color: #94a3b8;
}

.slot-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 3px;
}

.slot-radius {
  font-size: 9.5px;
  color: #b6c0cf;
}

.slot-status {
  font-size: 9.5px;
  color: #f04438;
}

.slot-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.slot-empty-text {
  font-size: 10.5px;
  color: #d5dce6;
}

.note {
  margin-top: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 15px 18px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-title {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.note-text {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.75;
}
</style>
