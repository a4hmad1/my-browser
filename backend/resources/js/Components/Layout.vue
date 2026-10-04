<script setup>
import {Link,usePage,router} from '@inertiajs/vue3';
import Icon from './Icon.vue';
defineProps({home:Boolean,owner:Boolean});const page=usePage();
</script>
<template><div :class="home?'original-site':'dashboard-site'" :data-owner="owner||undefined"><template v-if="home"><header class="site-header">
    <div class="header-inner">
      <a href="/" class="header-brand">
        <div class="brand-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <span class="brand-text">CineStream</span>
        <span class="version-tag">v1.1.0</span>
      </a>

      <nav class="header-nav">
        <a href="/#overview">Overview</a>
        <a href="/#preview">Preview</a>
        <a href="/#how-it-works">How It Works</a>
        <a href="/#sources">Directory</a>
        <Link v-if="page.props.user" href="/dashboard">Account</Link><Link v-else href="/login">Sign in</Link><Link v-if="page.props.user?.is_admin" href="/admin">Owner</Link><a href="/#download" class="btn-nav-download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </a>
      </nav>
    </div>
  </header></template><template v-else><aside v-if="owner" class="owner-sidebar"><Link href="/admin" class="sidebar-brand"><Icon name="film" /> CineStream</Link><small>OWNER WORKSPACE</small><nav aria-label="Owner navigation"><a href="/admin">Overview</a><a href="#members">Members</a><a href="#requests">Subscriptions <b v-if="page.props.stats?.pending" class="sidebar-count">{{ page.props.stats.pending }}</b></a><a href="#deliveries">Telegram deliveries</a><a href="#support">Support inbox</a><a href="#activity">Activity</a></nav><div class="sidebar-bottom"><Link href="/dashboard">My account ↗</Link><Link href="/">View website ↗</Link></div></aside><header class="dashboard-header"><Link href="/" class="dashboard-brand"><Icon name="film" :size="18" /> CineStream <span>{{owner?'Owner dashboard':'My account'}}</span></Link><nav><Link v-if="page.props.user?.is_admin && !owner" href="/admin">Owner dashboard</Link><Link v-if="!page.props.user" href="/login">Sign in</Link><span v-else>{{page.props.user.name}}</span><button v-if="page.props.user" class="quiet" @click="router.post('/logout')">Sign out</button></nav></header></template><main :class="{'account-content':!home}"><div v-if="page.props.flash?.message" class="notice" role="status">{{page.props.flash.message}}</div><slot /></main><template v-if="home"><footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-left">
        <span class="brand-text">CineStream</span>
        <p>&copy; 2026 CineStream Project. Open distribution, ad-shielded cinema browser.</p>
      </div>
      <div class="footer-right">
        <a href="/#overview">Overview</a>
        <a href="/#preview">Preview</a>
        <a href="/#how-it-works">Walkthrough</a>
        <a href="/#download">Download</a>
      </div>
    </div>
  </footer></template><footer v-else class="dashboard-footer">© 2026 CineStream · <Link href="/">Website</Link> · <a href="https://t.me/cinama_stream_bot" target="_blank" rel="noopener noreferrer">Telegram bot ↗</a></footer></div></template>
