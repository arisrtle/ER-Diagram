<template>
  <div class="login-shell">
    <div class="login-card">
      <div class="brand">
        <div class="brand-icon">签</div>
        <div>
          <h1>定位签到 · 管理端</h1>
          <p>教师 / 管理员登录</p>
        </div>
      </div>

      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="手机号">
          <el-input
            v-model="form.phone"
            placeholder="13800000001"
            size="large"
            clearable
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="teacher123"
            size="large"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="loading"
          @click="onSubmit"
        >
          登录
        </el-button>
      </el-form>

      <p class="hint">
        演示：王老师 13800000001 / teacher123<br />
        管理员 13800000000 / admin123
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { auth } from '../api'

const emit = defineEmits(['logged-in'])
const form = reactive({ phone: '13800000001', password: 'teacher123' })
const loading = ref(false)

async function onSubmit() {
  if (!form.phone || !form.password) {
    ElMessage.warning('请输入手机号和密码')
    return
  }
  loading.value = true
  try {
    const data = await auth.login(form.phone.trim(), form.password)
    emit('logged-in', data)
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>
