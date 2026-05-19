const API_URL = 'http://localhost:5000/api'

const loginForm = document.getElementById('login-form')
const registerForm = document.getElementById('register-form')
const showRegisterLink = document.getElementById('show-register')
const showLoginLink = document.getElementById('show-login')
const loginSubmit = document.getElementById('login-submit')
const registerSubmit = document.getElementById('register-submit')
const loginError = document.getElementById('login-error')
const registerError = document.getElementById('register-error')
const registerSuccess = document.getElementById('register-success')

showRegisterLink.addEventListener('click', () => {
  loginForm.style.display = 'none'
  registerForm.style.display = 'flex'
  loginError.textContent = ''
})

showLoginLink.addEventListener('click', () => {
  registerForm.style.display = 'none'
  loginForm.style.display = 'flex'
  registerError.textContent = ''
  registerSuccess.textContent = ''
})

loginSubmit.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value.trim()
  
  loginError.textContent = ''
  
  if (!email || !password) {
    loginError.textContent = 'Please fill in all fields'
    return
  }
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      loginError.textContent = data.error || 'Login failed'
      return
    }
    
    // Save token and redirect
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    window.location.href = 'index.html'
  } catch (error) {
    loginError.textContent = 'Connection error: ' + error.message
  }
})

registerSubmit.addEventListener('click', async () => {
  const username = document.getElementById('register-username').value.trim()
  const email = document.getElementById('register-email').value.trim()
  const password = document.getElementById('register-password').value.trim()
  const passwordConfirm = document.getElementById('register-password-confirm').value.trim()
  
  registerError.textContent = ''
  registerSuccess.textContent = ''
  
  if (!username || !email || !password || !passwordConfirm) {
    registerError.textContent = 'Please fill in all fields'
    return
  }
  
  if (password !== passwordConfirm) {
    registerError.textContent = 'Passwords do not match'
    return
  }
  
  if (password.length < 6) {
    registerError.textContent = 'Password must be at least 6 characters'
    return
  }
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      registerError.textContent = data.error || 'Registration failed'
      return
    }
    
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    window.location.href = 'index.html'
  } catch (error) {
    registerError.textContent = 'Connection error: ' + error.message
  }
})

window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    window.location.href = 'index.html'
  }
})
