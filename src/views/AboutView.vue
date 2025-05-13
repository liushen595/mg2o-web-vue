<script setup>
  import { ref } from 'vue';

  // 系统当前年份
  const currentYear = new Date().getFullYear();
  // 应用版本
  const appVersion = ref('1.0.0');
</script>

<template>
  <div class="about">
    <h1>苏博导智能体</h1>
    <div class="about-content">
      <section class="intro-section">
        <h2>应用介绍</h2>
        <p>苏博导智能体是一款专为博物馆访客设计的智能导游应用，通过自然语言对话方式为用户提供展览讲解与互动体验。</p>
        <p>本应用使用先进的语音识别和大语言模型技术，能够深入理解用户问题并提供专业、准确的博物馆展品知识。</p>
      </section>

      <section class="feature-section">
        <h2>主要功能</h2>
        <ul>
          <li>智能语音对话 - 直接与系统进行自然交流</li>
          <li>展品详细解说 - 获取展品历史背景与文化价值</li>
          <li>实时语音识别 - 准确识别用户问题</li>
          <li>专业知识推送 - 提供深度文化知识分享</li>
        </ul>
      </section>

      <section class="tech-section">
        <h2>技术实现</h2>
        <p>基于Vue.js框架开发的前端应用，WebSocket实时通信，集成语音识别与合成技术。</p>
        <p>Version: {{ appVersion }}</p>
      </section>

      <section class="contact-section">
        <h2>开发者信息</h2>
        <p>个人开发者作品</p>
        <p>联系邮箱: lajiprivatemail@proton.me</p>
      </section>

      <div class="copyright">
        <p>© {{ currentYear }} 苏博导智能体 - 保留所有权利</p>
        <p class="disclaimer">本应用仅用于博物馆教育目的，未经授权不得用于商业用途。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .about {
    padding: 2rem;
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
    background-color: #f8f9fa;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    color: #333;
  }

  h1 {
    font-size: 28px;
    margin-bottom: 2rem;
    color: #1890ff;
  }

  h2 {
    font-size: 20px;
    margin: 1.5rem 0 1rem;
    color: #444;
  }

  .about-content {
    text-align: left;
  }

  section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background-color: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  ul {
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }

  p {
    line-height: 1.6;
    margin-bottom: 0.8rem;
  }

  .copyright {
    margin-top: 2rem;
    padding-top: 1rem;
    font-size: 14px;
    color: #666;
    text-align: center;
    border-top: 1px solid #eaeaea;
  }

  .disclaimer {
    font-size: 12px;
    margin-top: 0.5rem;
    color: #888;
  }

  @media (max-width: 768px) {
    .about {
      padding: 1.5rem;
      margin: 0 1rem;
    }
  }
</style>