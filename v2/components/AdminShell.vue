<template>
  <view class="shell">
    <!-- 侧边栏 -->
    <view class="side">
      <view class="side-brand">
        <view class="logo"><text class="logo-text">签</text></view>
        <view class="brand-text">
          <text class="brand-name">课程签到</text>
          <text class="brand-sub">西安交通大学</text>
        </view>
      </view>

      <view class="menu">
        <view
          class="menu-item"
          v-for="m in menus"
          :key="m.key"
          :class="{ on: m.key === active }"
          @click="go(m)"
        >
          <text class="menu-dot" :class="{ on: m.key === active }"></text>
          <text class="menu-text" :class="{ on: m.key === active }">{{ m.label }}</text>
        </view>
      </view>

      <view class="side-foot">
        <view class="me">
          <view class="avatar"><text class="avatar-text">{{ initial }}</text></view>
          <view class="me-text">
            <text class="me-name">{{ user.name || '未登录' }}</text>
            <text class="me-role">{{ roleText }}</text>
          </view>
        </view>
        <view class="logout" @click="logout"><text class="logout-text">退出</text></view>
      </view>
    </view>

    <!-- 主区域 -->
    <view class="main">
      <view class="head">
        <view class="head-text">
          <text class="title">{{ title }}</text>
          <text class="subtitle" v-if="subtitle">{{ subtitle }}</text>
        </view>
        <view class="head-right">
          <view class="badge-mock" v-if="mockMode">
            <text class="badge-mock-text">离线演示</text>
          </view>
          <text class="clock">{{ clock }}</text>
        </view>
      </view>

      <slot></slot>
    </view>
  </view>
</template>

<script>
import { getUser, clearSession, isLoggedIn } from '../common/session'
import { isMockMode } from '../common/request'

export default {
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    active: { type: String, default: '' }
  },

  data() {
    return {
      user: {},
      mockMode: false,
      clock: '',
      timer: null
    }
  },

  computed: {
    initial() {
      return this.user.name ? this.user.name.slice(0, 1) : '·'
    },
    roleText() {
      const map = { student: '学生', teacher: '教师', admin: '管理员' }
      return map[this.user.role] || ''
    },
    menus() {
      const all = [
        { key: 'dashboard', label: '概览', url: '/pages/admin/dashboard' },
        { key: 'courses', label: '课程信息维护', url: '/pages/admin/courses' },
        { key: 'schedule', label: '课程安排', url: '/pages/admin/schedule' },
        { key: 'teachers', label: '教师分配', url: '/pages/admin/teachers' },
        { key: 'records', label: '签到记录', url: '/pages/admin/records' }
      ]
      // 教师角色只开放签到记录（且只能看自己课程）
      if (this.user.role === 'teacher') {
        return all.filter((m) => m.key === 'records' || m.key === 'dashboard')
      }
      return all
    }
  },

  // 注意：这是**组件**，不能用 onLoad / onShow（那是页面生命周期，组件里不会触发）
  created() {
    if (!isLoggedIn()) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.user = getUser() || {}
    this.mockMode = isMockMode()
    this.tick()
    this.timer = setInterval(() => this.tick(), 30000)
  },

  beforeUnmount() {
    if (this.timer) clearInterval(this.timer)
  },

  methods: {
    tick() {
      const d = new Date()
      const p = (n) => (n < 10 ? '0' + n : n)
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
      this.clock = `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${wd} ${p(d.getHours())}:${p(d.getMinutes())}`
    },

    go(m) {
      if (m.key === this.active) return
      uni.reLaunch({ url: m.url })
    },

    logout() {
      uni.showModal({
        title: '退出登录',
        content: '确认退出当前账号？',
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
.shell {
  min-height: 100vh;
  background: #f5f7fb;
  display: flex;
}

/* ---------- 侧边栏 ---------- */
.side {
  width: 214px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #edf1f7;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 22px 14px 16px;
  box-sizing: border-box;
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 22px;
}

.logo {
  width: 36px;
  height: 36px;
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
  font-size: 14.5px;
  font-weight: 700;
  color: #0f172a;
}

.brand-sub {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 1px;
}

.menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.menu-item:hover {
  background: #f7f9fc;
}

.menu-item.on {
  background: #eef4ff;
}

.menu-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #cbd5e1;
}

.menu-dot.on {
  background: #2563eb;
}

.menu-text {
  font-size: 13px;
  color: #475569;
}

.menu-text.on {
  color: #1d4ed8;
  font-weight: 600;
}

.side-foot {
  border-top: 1px solid #edf1f7;
  padding-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.me {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #eef4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 12px;
  color: #2563eb;
  font-weight: 600;
}

.me-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.me-name {
  font-size: 12px;
  color: #0f172a;
  font-weight: 500;
}

.me-role {
  font-size: 10px;
  color: #94a3b8;
}

.logout {
  padding: 4px 6px;
}

.logout-text {
  font-size: 11px;
  color: #94a3b8;
}

.logout-text:hover {
  color: #f04438;
}

/* ---------- 主区域 ---------- */
.main {
  flex: 1;
  min-width: 0;
  padding: 24px 28px 44px;
  max-width: 1180px;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}

.head-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 21px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 12px;
  color: #94a3b8;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge-mock {
  background: #fff5e6;
  border: 1px solid #ffe0b2;
  border-radius: 999px;
  padding: 3px 9px;
}

.badge-mock-text {
  font-size: 10px;
  color: #b54708;
}

.clock {
  font-size: 11.5px;
  color: #94a3b8;
}

@media (max-width: 820px) {
  .shell {
    flex-direction: column;
  }

  .side {
    position: static;
    width: 100%;
    height: auto;
    padding: 14px 14px 10px;
    border-right: none;
    border-bottom: 1px solid #edf1f7;
  }

  .side-brand {
    padding-bottom: 12px;
  }

  .menu {
    flex-direction: row;
    overflow-x: auto;
    gap: 6px;
    padding-bottom: 4px;
  }

  .menu-item {
    flex-shrink: 0;
    background: #f7f9fc;
  }

  .side-foot {
    display: none;
  }

  .main {
    padding: 18px 14px 32px;
  }
}
</style>
