<template>
  <view class="login-page">
    <view class="brand">
      <view class="brand-icon">签</view>
      <text class="brand-title">定位签到</text>
      <text class="brand-sub">学生端</text>
    </view>

    <view class="form">
      <view class="field">
        <text class="field-label">学号</text>
        <input
          v-model="studentNo"
          class="input"
          type="text"
          placeholder="请输入10位学号"
          maxlength="10"
        />
      </view>
      <view class="field">
        <text class="field-label">姓名</text>
        <input
          v-model="name"
          class="input"
          type="text"
          placeholder="请输入姓名"
          maxlength="20"
        />
      </view>
      <button class="login-btn" :disabled="loading" @click="onLogin">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </view>

    <text class="tip">首次登录后，下次打开将自动进入签到页</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getToken, setAuth } from '../../common/auth'
import * as api from '../../common/api'

const studentNo = ref('')
const name = ref('')
const loading = ref(false)

onLoad(() => {
  if (getToken()) {
    uni.reLaunch({ url: '/pages/checkin/checkin' })
  }
})

async function onLogin() {
  if (loading.value) return
  const no = studentNo.value.trim()
  const nm = name.value.trim()
  if (!/^\d{10}$/.test(no)) {
    uni.showToast({ title: '学号必须是10位数字', icon: 'none' })
    return
  }
  if (!nm) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await api.login(no, nm)
    setAuth(res.access_token, res.user)
    uni.reLaunch({ url: '/pages/checkin/checkin' })
  } catch (e) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: calc(var(--status-bar-height, 0px) + 90rpx) 56rpx 60rpx;
  background: linear-gradient(180deg, #f2f7ff 0%, #ffffff 55%);
}

.brand {
  text-align: center;
}

.brand-icon {
  width: 120rpx;
  height: 120rpx;
  margin: 0 auto 24rpx;
  border-radius: 36rpx;
  background: linear-gradient(145deg, #4a90ff, #1f66e0);
  box-shadow: 0 18rpx 46rpx rgba(31, 102, 224, 0.25);
  color: #ffffff;
  font-size: 56rpx;
  font-weight: 700;
  line-height: 120rpx;
}

.brand-title {
  display: block;
  font-size: 46rpx;
  font-weight: 700;
  color: #14213a;
}

.brand-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  letter-spacing: 2rpx;
  color: #8d99ad;
}

.form {
  margin-top: 80rpx;
}

.field {
  margin-bottom: 28rpx;
}

.field-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #6b7a90;
}

.input {
  width: 100%;
  height: 96rpx;
  padding: 0 28rpx;
  box-sizing: border-box;
  border: 2rpx solid #e3ebf7;
  border-radius: 20rpx;
  background: #ffffff;
  color: #14213a;
  font-size: 30rpx;
  outline: none;
}

.login-btn {
  margin-top: 20rpx;
  height: 96rpx;
  line-height: 96rpx;
  border: none;
  border-radius: 48rpx;
  background: linear-gradient(145deg, #4a90ff, #1f66e0);
  box-shadow: 0 18rpx 40rpx rgba(31, 102, 224, 0.24);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
}

.login-btn::after {
  border: none;
}

.login-btn[disabled] {
  opacity: 0.6;
}

.tip {
  display: block;
  margin-top: 32rpx;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9aa6b8;
}
</style>
