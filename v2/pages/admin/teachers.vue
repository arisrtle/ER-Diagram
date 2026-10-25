<template>
  <admin-shell
    title="教师分配"
    subtitle="教师是用户角色，不单独建表；一门课只指定一位授课教师"
    active="teachers"
  >
    <view class="layout">
      <!-- 教师名册 -->
      <view class="panel teachers">
        <view class="panel-head">
          <text class="panel-title">教师名册</text>
          <text class="link" @click="openCreate">+ 新增教师</text>
        </view>

        <view class="teacher-list">
          <view class="teacher" v-for="t in teachers" :key="t._id">
            <view class="avatar"><text class="avatar-text">{{ (t.name || '?').slice(0, 1) }}</text></view>
            <view class="teacher-body">
              <text class="teacher-name">{{ t.name }}</text>
              <text class="teacher-meta">{{ t.title || '教师' }} · {{ t.account }}</text>
            </view>
            <view class="load">
              <text class="load-num">{{ workload(t._id) }}</text>
              <text class="load-label">门课</text>
            </view>
          </view>

          <view class="empty" v-if="!teachers.length">
            <text class="empty-text">{{ loading ? '加载中…' : '还没有教师账号' }}</text>
          </view>
        </view>
      </view>

      <!-- 课程分配 -->
      <view class="panel">
        <view class="panel-head">
          <text class="panel-title">课程 ↔ 教师</text>
          <text class="panel-hint">选择后立即保存</text>
        </view>

        <view class="rows">
          <view class="row th">
            <text class="cell c-course">课程</text>
            <text class="cell c-time">上课时间</text>
            <text class="cell c-current">当前教师</text>
            <text class="cell c-action">分配</text>
          </view>

          <view class="row" v-for="c in courses" :key="c._id">
            <view class="cell c-course">
              <text class="course-name">{{ c.name }}</text>
              <text class="course-sub">{{ c.locationName || '未设点位' }}</text>
            </view>
            <text class="cell c-time">{{ weekdayText(c.weekday) }} {{ c.startTime }}</text>
            <text class="cell c-current">{{ c.teacherName || '未分配' }}</text>
            <view class="cell c-action">
              <picker
                mode="selector"
                :range="teacherNames"
                :value="indexOfTeacher(c.teacherId)"
                @change="(e) => assign(c, e.detail.value)"
              >
                <view class="assign-btn">
                  <text class="assign-text">{{ savingId === c._id ? '保存中…' : '更换教师' }}</text>
                </view>
              </picker>
            </view>
          </view>

          <view class="empty" v-if="!courses.length">
            <text class="empty-text">还没有课程，请先在「课程信息维护」中新增</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 新增教师 -->
    <view class="mask" v-if="showForm" @click="showForm = false">
      <view class="dialog" @click.stop>
        <view class="dialog-head">
          <text class="dialog-title">新增教师账号</text>
          <text class="dialog-close" @click="showForm = false">×</text>
        </view>
        <view class="dialog-body">
          <view class="field">
            <text class="label">工号</text>
            <input class="input" v-model="form.account" maxlength="20" placeholder="如：T1005" placeholder-class="ph" />
          </view>
          <view class="field">
            <text class="label">姓名</text>
            <input class="input" v-model="form.name" maxlength="20" placeholder="如：陈老师" placeholder-class="ph" />
          </view>
          <view class="field">
            <text class="label">职称 / 院系</text>
            <input class="input" v-model="form.title" maxlength="20" placeholder="如：副教授" placeholder-class="ph" />
          </view>
          <view class="field">
            <text class="label">初始密码</text>
            <input class="input" v-model="form.password" maxlength="32" placeholder="默认 123456" placeholder-class="ph" />
          </view>
          <view class="hint">
            <text class="hint-text">教师登录后只能查看自己所授课程的签到记录，不能修改课程与记录。</text>
          </view>
        </view>
        <view class="dialog-foot">
          <view class="btn-ghost" @click="showForm = false"><text class="btn-ghost-text">取消</text></view>
          <view class="btn-primary" @click="createTeacher"><text class="btn-primary-text">创建</text></view>
        </view>
      </view>
    </view>
  </admin-shell>
</template>

<script>
import AdminShell from '../../components/AdminShell.vue'
import { api } from '../../common/request'
import { requireLogin, getUser } from '../../common/session'
import { weekdayText } from '../../common/format'

export default {
  components: { AdminShell },

  data() {
    return {
      loading: true,
      savingId: '',
      teachers: [],
      courses: [],
      showForm: false,
      form: { account: '', name: '', title: '', password: '' }
    }
  },

  computed: {
    teacherNames() {
      return this.teachers.map((t) => `${t.name}（${t.account}）`)
    }
  },

  onShow() {
    if (!requireLogin()) return
    const user = getUser() || {}
    if (user.role !== 'admin') {
      uni.reLaunch({ url: '/pages/admin/records' })
      return
    }
    this.load()
  },

  methods: {
    weekdayText,

    async load() {
      this.loading = true
      try {
        const [teachers, courses] = await Promise.all([api.teacherList(), api.courseList('all')])
        this.teachers = teachers || []
        this.courses = courses || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    workload(teacherId) {
      return this.courses.filter((c) => c.teacherId === teacherId).length
    },

    indexOfTeacher(id) {
      const i = this.teachers.findIndex((t) => t._id === id)
      return i >= 0 ? i : 0
    },

    async assign(course, index) {
      const t = this.teachers[Number(index)]
      if (!t || t._id === course.teacherId) return

      this.savingId = course._id
      try {
        // 复用 course.save：把整门课原样提交，只替换 teacherId
        await api.courseSave({
          id: course._id,
          name: course.name,
          teacherId: t._id,
          weekday: course.weekday,
          startTime: course.startTime,
          endTime: course.endTime,
          locationName: course.locationName,
          latitude: course.latitude,
          longitude: course.longitude,
          radius: course.radius,
          status: course.status
        })
        uni.showToast({ title: `已分配给 ${t.name}`, icon: 'none' })
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '分配失败', icon: 'none' })
      } finally {
        this.savingId = ''
      }
    },

    openCreate() {
      this.form = { account: '', name: '', title: '', password: '' }
      this.showForm = true
    },

    async createTeacher() {
      const f = this.form
      if (!f.account.trim()) return uni.showToast({ title: '请填写工号', icon: 'none' })
      if (!f.name.trim()) return uni.showToast({ title: '请填写姓名', icon: 'none' })
      try {
        await api.userCreate({
          account: f.account.trim(),
          name: f.name.trim(),
          role: 'teacher',
          title: f.title.trim(),
          password: f.password || '123456'
        })
        this.showForm = false
        uni.showToast({ title: '教师已创建', icon: 'success' })
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '创建失败', icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
  align-items: start;
}

.panel {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.panel-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #0f172a;
}

.panel-hint {
  font-size: 10.5px;
  color: #b6c0cf;
}

.link {
  font-size: 11.5px;
  color: #2563eb;
  cursor: pointer;
}

.teacher-list {
  display: flex;
  flex-direction: column;
}

.teacher {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px dashed #f1f5f9;
}

.teacher:last-child {
  border-bottom: none;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #eef4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 12.5px;
  color: #2563eb;
  font-weight: 600;
}

.teacher-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.teacher-name {
  font-size: 12.5px;
  color: #0f172a;
  font-weight: 500;
}

.teacher-meta {
  font-size: 10px;
  color: #94a3b8;
}

.load {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex-shrink: 0;
}

.load-num {
  font-size: 13px;
  color: #2563eb;
  font-weight: 600;
}

.load-label {
  font-size: 9.5px;
  color: #b6c0cf;
}

.rows {
  display: flex;
  flex-direction: column;
}

.row {
  display: grid;
  grid-template-columns: 1.6fr 1fr 0.9fr 0.9fr;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid #f6f8fc;
}

.row.th {
  padding: 6px 0;
  border-bottom: 1px solid #eef2f7;
}

.cell {
  font-size: 12px;
  color: #475569;
  min-width: 0;
}

.th .cell {
  font-size: 11px;
  color: #94a3b8;
}

.course-name {
  display: block;
  font-size: 12.5px;
  color: #0f172a;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.course-sub {
  display: block;
  font-size: 10px;
  color: #b6c0cf;
  margin-top: 2px;
}

.assign-btn {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 7px;
  background: #f4f7ff;
  border: 1px solid #dbeafe;
  cursor: pointer;
}

.assign-text {
  font-size: 10.5px;
  color: #2563eb;
}

.empty {
  padding: 40px 0;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: #cbd5e1;
}

/* 弹窗 */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
  padding: 20px;
}

.dialog {
  width: 420px;
  max-width: 100%;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.24);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 10px;
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.dialog-close {
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
}

.dialog-body {
  padding: 4px 22px 8px;
}

.field {
  margin-bottom: 12px;
}

.label {
  display: block;
  font-size: 11.5px;
  color: #64748b;
  margin-bottom: 6px;
}

.input {
  height: 36px;
  background: #f6f8fc;
  border-radius: 9px;
  padding: 0 11px;
  font-size: 12.5px;
  color: #0f172a;
}

.ph {
  color: #b6c0cf;
  font-size: 12px;
}

.hint {
  background: #f7f9fc;
  border-radius: 9px;
  padding: 9px 11px;
}

.hint-text {
  font-size: 10.5px;
  color: #94a3b8;
  line-height: 1.6;
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 22px 20px;
}

.btn-primary {
  height: 36px;
  padding: 0 18px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
}

.btn-primary-text {
  font-size: 12.5px;
  color: #fff;
}

.btn-ghost {
  height: 36px;
  padding: 0 18px;
  border-radius: 10px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
}

.btn-ghost-text {
  font-size: 12.5px;
  color: #475569;
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
