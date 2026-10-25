<template>
  <LoginView v-if="!token" @logged-in="handleLoggedIn" />
  <DashboardView v-else :user="user" @logout="handleLogout" />
</template>

<script setup>
import { ref } from 'vue'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'

const token = ref(localStorage.getItem('admin_token') || '')
const user = ref(JSON.parse(localStorage.getItem('admin_user') || 'null'))

function handleLoggedIn(data) {
  token.value = data.access_token
  user.value = data.user
  localStorage.setItem('admin_token', data.access_token)
  localStorage.setItem('admin_user', JSON.stringify(data.user))
}

function handleLogout() {
  token.value = ''
  user.value = null
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
}
</script>
