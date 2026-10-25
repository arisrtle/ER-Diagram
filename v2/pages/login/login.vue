<template>
  <view class="page">
    <view class="aurora a1"></view>
    <view class="aurora a2"></view>

    <view class="shell">
      <view class="brand">
        <view class="logo">
          <text class="logo-text">签</text>
        </view>
        <view class="brand-text">
          <text class="brand-name">课程签到</text>
          <text class="brand-sub">西安交通大学</text>
        </view>
      </view>

      <view class="card">
        <view class="switch">
          <view class="switch-thumb" :class="{ right: mode === 'register' }"></view>
          <view class="switch-item" :class="{ on: mode === 'login' }" @click="setMode('login')">登录</view>
          <view class="switch-item" :class="{ on: mode === 'register' }" @click="setMode('register')">注册</view>
        </view>

        <view class="field">
          <text class="label">账号</text>
          <view class="input-wrap" :class="{ active: focus === 'account' }">
            <input
              class="input"
              v-model="form.account"
              :maxlength="20"
              placeholder="学号 / 工号"
              placeholder-class="ph"
              @focus="focus = 'account'"
              @blur="focus = ''"
            />
          </view>
        </view>

        <view class="field" v-if="mode === 'register'">
          <text class="label">姓名</text>
          <view class="input-wrap" :class="{ active: focus === 'name' }">
            <input
              class="input"
              v-model="form.name"
              :maxlength="20"
              placeholder="真实姓名"
              placeholder-class="ph"
              @focus="focus = 'name'"
              @blur="focus = ''"
            />
          </view>
        </view>

        <view class="field" v-if="mode === 'register'">
          <text class="label">班级</text>
          <view class="input-wrap" :class="{ active: focus === 'className' }">
            <input
              class="input"
              v-model="form.className"
              :maxlength="40"
              placeholder="如：电气工程及其自动化 2301 班"
              placeholder-class="ph"
              @focus="focus = 'className'"
              @blur="focus = ''"
            />
          </view>
        </view>

        <view class="field">
          <text class="label">密码</text>
          <view class="input-wrap" :class="{ active: focus === 'password' }">
            <input
              class="input"
              v-model="form.password"
              password
              :maxlength="32"
              placeholder="6~32 位"
              placeholder-class="ph"
              @focus="focus = 'password'"
              @blur="focus = ''"
            />
          </view>
        </view>

        <view class="submit" :class="{ disabled: loading }" @click="submit">
          <text class="submit-text">{{ loading ? '请稍候…' : mode === 'login' ? '登 录' : '注 册' }}</text>
        </view>

        <view class="error" v-if="errorMsg">
          <text class="error-text">{{ errorMsg }}</text>
        </view>
      </view>

      <view class="demo" v-if="mode === 'login'">
        <text class="demo-title">演示账号 · 点击填入</text>
        <view class="chips">
          <view class="chip" v-for="d in demos" :key="d.account" @click="fill(d)">
            <text class="chip-role">{{ d.label }}</text>
            <text class="chip-name">{{ d.desc }}</text>
          </view>
        </view>
      </view>

      <view class="foot">
        <text class="foot-link" @click="initData">首次部署？初始化演示数据</text>
      </view>
      <text class="copyright">© 2026 西安交通大学 · 课程签到</text>
    </view>
  </view>
</template>

<script>
import { api, isMockMode } from '../../common/request'
import { saveSession, isLoggedIn, getUser } from '../../common/session'
import { DEMO_ACCOUNTS } from '../../common/config'

export default {
  data() {
    return {
      mode: 'login',
      loading: false,
      focus: '',
      errorMsg: '',
      demos: DEMO_ACCOUNTS,
      form: { account: '', password: '', name: '', className: '' }
    }
  },

  onLoad() {
    // 已登录直接进入对应首页，避免重复登录
    if (isLoggedIn()) {
      const user = getUser()
      this.goHome(user && user.role)
    }
  },

  methods: {
    setMode(mode) {
      this.mode = mode
      this.errorMsg = ''
    },

    fill(d) {
      this.form.account = d.account
      this.form.password = d.password
      this.errorMsg = ''
    },

    async submit() {
      if (this.loading) return
      this.errorMsg = ''

      const account = String(this.form.account || '').trim()
      const password = String(this.form.password || '')

      if (!account) {
        this.errorMsg = '请输入账号'
        return
      }
      if (!password) {
        this.errorMsg = '请输入密码'
        return
      }
      if (this.mode === 'register') {
        if (!String(this.form.name || '').trim()) {
          this.errorMsg = '请填写真实姓名'
          return
        }
        if (password.length < 6) {
          this.errorMsg = '密码至少 6 位'
          return
        }
      }

      this.loading = true
      try {
        const data =
          this.mode === 'login'
            ? await api.login(account, password)
            : await api.register({
                account,
                password,
                name: String(this.form.name || '').trim(),
                className: String(this.form.className || '').trim()
              })

        saveSession(data.token, data.user)

        if (isMockMode()) {
          uni.showToast({ title: '离线演示模式', icon: 'none' })
        }

        this.goHome(data.user && data.user.role)
      } catch (e) {
        this.errorMsg = e.message || '操作失败，请重试'
      } finally {
        this.loading = false
      }
    },

    goHome(role) {
      const url = role === 'student' ? '/pages/signin/signin' : '/pages/admin/dashboard'
      uni.reLaunch({ url })
    },

    async initData() {
      if (this.loading) return
      this.loading = true
      try {
        const res = await api.init()
        const added = (res && res.added) || { users: 0, courses: 0 }
        const skipped = (res && res.skipped) || { users: 0, courses: 0 }

        if (res && res.seeded) {
          const skipNote =
            skipped.users > 0 ? `\n已存在的 ${skipped.users} 个账号已跳过，不会重复创建。` : ''
          uni.showModal({
            title: '初始化完成',
            content:
              `新增 ${added.users} 个账号、${added.courses} 门课程。${skipNote}` +
              '\n\n管理员 admin / 123456\n教师 T1001 / 123456\n学生 20230101001 / 123456',
            showCancel: false
          })
        } else {
          uni.showModal({
            title: '无需初始化',
            content: '演示账号与课程都已存在，可直接用下方账号登录。',
            showCancel: false
          })
        }
      } catch (e) {
        uni.showModal({
          title: '初始化失败',
          content: e.message || '请确认 api 云函数已上传部署',
          showCancel: false
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  padding: 40px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #eef4ff 0%, #f5f7fb 42%, #f5f7fb 100%);
  overflow: hidden;
}

.aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.55;
  pointer-events: none;
}

.a1 {
  width: 320px;
  height: 320px;
  top: -110px;
  left: -80px;
  background: #bfd5ff;
}

.a2 {
  width: 260px;
  height: 260px;
  right: -90px;
  bottom: -60px;
  background: #d7e6ff;
}

.shell {
  position: relative;
  width: 100%;
  max-width: 420px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 26px;
  padding-left: 4px;
}

.logo {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
}

.logo-text {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 1px;
}

.brand-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
  letter-spacing: 0.5px;
}

.card {
  background: #fff;
  border-radius: 22px;
  padding: 22px 22px 24px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
}

.switch {
  position: relative;
  display: flex;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 22px;
}

.switch-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: #fff;
  border-radius: 9px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  transition: transform 0.22s ease;
}

.switch-thumb.right {
  transform: translateX(100%);
}

.switch-item {
  position: relative;
  z-index: 1;
  flex: 1;
  text-align: center;
  font-size: 14px;
  line-height: 34px;
  color: #64748b;
  transition: color 0.2s;
}

.switch-item.on {
  color: #0f172a;
  font-weight: 600;
}

.field {
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 7px;
  padding-left: 2px;
}

.input-wrap {
  border: 1.5px solid transparent;
  background: #f6f8fc;
  border-radius: 12px;
  padding: 0 14px;
  transition: border-color 0.18s, background 0.18s;
}

.input-wrap.active {
  border-color: #2563eb;
  background: #fff;
}

.input {
  height: 46px;
  font-size: 15px;
  color: #0f172a;
  width: 100%;
}

.ph {
  color: #b6c0cf;
  font-size: 14px;
}

.submit {
  margin-top: 24px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.26);
  transition: transform 0.12s, opacity 0.2s;
}

.submit:active {
  transform: scale(0.985);
}

.submit.disabled {
  opacity: 0.6;
}

.submit-text {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
}

.error {
  margin-top: 12px;
  padding: 9px 12px;
  background: #fdeceb;
  border-radius: 9px;
}

.error-text {
  font-size: 12.5px;
  color: #d92d20;
  line-height: 1.5;
}

.demo {
  margin-top: 22px;
}

.demo-title {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 10px;
  padding-left: 4px;
}

.chips {
  display: flex;
  gap: 10px;
}

.chip {
  flex: 1;
  background: #fff;
  border: 1px solid #e8edf5;
  border-radius: 12px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.chip:active {
  border-color: #2563eb;
  background: #f7faff;
}

.chip-role {
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
}

.chip-name {
  font-size: 11px;
  color: #94a3b8;
}

.foot {
  margin-top: 18px;
  text-align: center;
}

.foot-link {
  font-size: 12.5px;
  color: #64748b;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.copyright {
  display: block;
  margin-top: 26px;
  text-align: center;
  font-size: 11px;
  color: #b6c0cf;
  letter-spacing: 0.5px;
}
</style>
