<script setup>
  import { RouterLink, RouterView } from 'vue-router'
  import { ref, onMounted } from 'vue'

  const isScrolled = ref(false)

  onMounted(() => {
    window.addEventListener('scroll', handleScroll)
  })

  function handleScroll() {
    isScrolled.value = window.scrollY > 20
  }
</script>

<template>
  <div class="app-container">
    <header :class="{ 'scrolled': isScrolled }">
      <div class="header-container">
        <div class="logo">
          <span>苏博导</span>
        </div>
        <nav>
          <RouterLink to="/" class="nav-link" active-class="active">
            <span>首页</span>
          </RouterLink>
          <RouterLink to="/about" class="nav-link" active-class="active">
            <span>关于</span>
          </RouterLink>
        </nav>
      </div>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
    padding-top: 80px;
    /* Increased padding to accommodate new header height */
  }

  header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 70px;
    /* Increased header height */
    z-index: 1000;
    /* Ensure header is above other content */
    background-color: rgba(255, 255, 255, 0.85);
    /* Slightly more transparent */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    /* Softer shadow */
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    /* Smoother transition */
    display: flex;
    /* Align items in header */
    align-items: center;
    /* Center items vertically */
    padding: 0 2rem;
    /* Add horizontal padding */
  }

  header.scrolled {
    height: 60px;
    background-color: rgba(255, 255, 255, 0.95);
    /* Less transparent when scrolled */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    /* Slightly stronger shadow when scrolled */
    backdrop-filter: blur(10px);
    /* Add blur effect when scrolled */
  }

  .header-container {
    display: flex;
    justify-content: space-between;
    /* Space out logo and nav */
    align-items: center;
    width: 100%;
    max-width: 1200px;
    /* Optional: constrain width for larger screens */
    margin: 0 auto;
    /* Center container */
  }

  .logo span {
    font-size: 1.8rem;
    /* Larger logo text */
    font-weight: 700;
    /* Bolder logo text */
    color: #333;
    /* Darker logo color */
  }

  nav {
    display: flex;
    gap: 1.5rem;
    /* Space between nav links */
  }

  .nav-link {
    text-decoration: none;
    color: #555;
    /* Slightly lighter nav link color */
    font-size: 1rem;
    font-weight: 500;
    /* Medium weight for nav links */
    padding: 0.5rem 0;
    /* Add some padding for easier clicking */
    position: relative;
    transition: color 0.2s ease-in-out;
  }

  .nav-link:hover {
    color: #1890ff;
    /* Highlight color on hover */
  }

  .nav-link.active {
    color: #1890ff;
    /* Active link color */
    font-weight: 600;
    /* Bolder active link */
  }

  .nav-link.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    /* Position underline slightly below text */
    left: 0;
    width: 100%;
    height: 2px;
    background-color: #1890ff;
    /* Underline color for active link */
    border-radius: 1px;
    /* Rounded underline */
  }

  /* Remove icon styles if not used */
  .nav-icon {
    display: none;
  }
</style>