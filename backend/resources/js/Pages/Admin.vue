<script setup>
import {reactive,computed,ref} from 'vue';
import {router,usePage,Link,usePoll} from '@inertiajs/vue3';
import Layout from '../Components/Layout.vue';
import Icon from '../Components/Icon.vue';
const props=defineProps({users:Object,plans:Array,search:String,status:String,events:Array,stats:Object,daily:Array,requests:Array,deliveries:Array,supportTickets:Array,telegramAvailable:Boolean,activationCodes:Array,codeStats:Object,codeSearch:String,codeStatus:String});
const page=usePage(),replies=reactive({}),choice=reactive({}),query=reactive({search:props.search,status:props.status}),codeQuery=reactive({code_search:props.codeSearch||'',code_status:props.codeStatus||'all'}),busy=ref(false);
function filterCodes(){ router.get('/admin',{...query,...codeQuery},{preserveScroll:true}); }
usePoll(10000,{only:['stats','requests','deliveries','supportTickets','events']});
const maxDaily=computed(()=>Math.max(1,...props.daily.map(d=>d.count)));
const cards=[['users','Total members','All registered accounts'],['paid','Paid memberships','Unexpired, unsuspended'],['trials','Free trials','Within the first day'],['verified','Telegram verified','Ready for bot delivery'],['pending','Plan requests','Awaiting your review'],['suspended','Suspended','Owner restricted']];
function settings(id){return choice[id]??(choice[id]={plan:'basic',months:1});}
function post(url,data={}){if(busy.value)return;busy.value=true;router.post(url,data,{preserveScroll:true,onFinish:()=>busy.value=false});}
const date=v=>v?new Date(v).toLocaleString():'—';
</script>
<template><Layout owner><section class="section"><div class="control-heading"><div><p class="eyebrow">CINESTREAM / OWNER CONTROL ROOM</p><h1 class="page-title">Owner dashboard</h1><p class="muted">A clear view of your members, requests, and Telegram deliveries.</p></div><span class="pill">{{ telegramAvailable?'BOT CONNECTED':'BOT SETUP PENDING' }}</span></div>
<section class="pending-queue" aria-label="Pending subscription requests"><h3 id="requests">Subscription requests <span class="pill">{{ stats.pending }} pending</span></h3><div v-if="!requests.length" class="empty-state muted">You're all caught up. New plan requests will appear here.</div><div v-for="request in requests" :key="request.id" class="pending-request"><div><strong>{{ request.name }}</strong><small>{{ request.email }} · @{{ request.telegram_username }}</small></div><div><strong>{{ request.plan.toUpperCase() }} · {{ request.months===12?'1 year':'1 month' }}</strong><small>{{ request.amount.toLocaleString() }} IQD · {{ date(request.created_at) }}</small></div><div class="actions"><button class="button small" :disabled="busy || !telegramAvailable" @click="post('/admin/requests/'+request.id+'/approve')">Payment approved · send code <Icon name="arrow" :size="14" /></button><button class="quiet" :disabled="busy" @click="post('/admin/requests/'+request.id+'/decline')">Decline</button></div></div></section>
<div class="stats-grid"><article class="stat" v-for="[key,label,hint] in cards" :key="key"><span>{{ label }}</span><strong>{{ stats[key].toLocaleString() }}</strong><small>{{ hint }}</small></article></div>
<div v-if="Object.keys(page.props.errors||{}).length" class="error error-banner" role="alert"><p v-for="error in page.props.errors">{{ error }}</p></div>
<div v-if="page.props.flash.token" class="notice"><b>Copy this one-time subscription code:</b><input readonly :value="page.props.flash.token" @focus="$event.target.select()" aria-label="New subscription code" /></div>
<div class="admin-grid"><article class="panel"><p class="eyebrow">MEMBER GROWTH</p><h3>New registrations</h3><div class="chart" role="img" :aria-label="'New members: '+daily.map(d=>d.label+' '+d.count).join(', ')"><div v-for="day in daily" :key="day.label" class="chart-col"><b>{{ day.count }}</b><i :style="{height:(day.count/maxDaily*95+3)+'px'}"></i><small>{{ day.label }}</small></div></div></article><article class="panel"><p class="eyebrow">TELEGRAM DELIVERY</p><h3>Subscription delivery</h3><p class="muted">Review payment before approving a plan request. The bot sends a code bound to that user. They activate it themselves.</p><p class="fine">Failed deliveries keep the same encrypted code for a retry. Sent codes are never displayed in this history.</p></article></div>

<h3 id="members" class="section-title">Members</h3><form class="admin-search" @submit.prevent="router.get('/admin',query,{preserveScroll:true})"><input v-model="query.search" aria-label="Search users" placeholder="Name, email or Telegram username…" /><select v-model="query.status" aria-label="Filter members"><option value="all">All members</option><option value="active">Active access</option><option value="expired">Expired</option><option value="suspended">Suspended</option><option value="telegram">Telegram verified</option></select><button class="button small">Search</button></form>
<div class="table-wrap"><table><thead><tr><th>Member</th><th>Membership</th><th>Telegram / Access</th><th>Activation code</th><th>Account</th></tr></thead><tbody><tr v-for="user in users.data" :key="user.id"><td><div class="user-cell"><span class="avatar">{{ user.name.slice(0,2).toUpperCase() }}</span><div><b>{{ user.name }} <span v-if="user.is_admin" class="pill">OWNER</span></b><small>{{ user.email }}</small><small>Joined {{ new Date(user.created_at).toLocaleDateString() }}</small></div></div></td><td>{{ user.access.trial?'Free trial':user.access.plan.toUpperCase() }}<small>Ends {{ date(user.access.ends_at) }}</small></td><td><span class="pill">{{ user.access.suspended?'Suspended':user.access.telegram_required?'Verification needed':user.access.active?'Active':'Expired' }}</span><small>@{{ user.telegram_username||'not provided' }} · {{ user.access.telegram_verified?'Verified':'Not verified' }}</small></td><td><div class="inline-form"><select v-model="settings(user.id).plan" aria-label="Plan"><option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option></select><select v-model="settings(user.id).months" aria-label="Duration"><option :value="1">1 month</option><option :value="12">1 year</option></select><button class="button small" :disabled="busy" @click="post('/admin/users/'+user.id+'/tokens',settings(user.id))">Issue code</button></div><button class="quiet" :disabled="busy || !telegramAvailable || !user.access.telegram_verified || user.access.suspended" @click="post('/admin/users/'+user.id+'/tokens',{...settings(user.id),send_telegram:true})">Send code via Telegram ↗</button></td><td><button v-if="!user.is_admin" class="quiet" :disabled="busy" @click="router.patch('/admin/users/'+user.id,{suspended:!user.access.suspended},{preserveScroll:true})">{{ user.access.suspended?'Approve':'Suspend' }}</button><small v-else>Protected</small></td></tr><tr v-if="!users.data.length"><td colspan="5">No accounts match your search.</td></tr></tbody></table></div>
<div class="pagination"><template v-for="link in users.links" :key="link.label"><Link v-if="link.url" :href="link.url" :class="{current:link.active}" v-html="link.label" /><span v-else v-html="link.label"></span></template></div>

<h3 id="activation-codes" class="section-title">Lifetime Activation Codes (6-Digit)</h3>
<p class="muted">Each code is single-use and locks to 1 device. If a customer deletes or reinstalls the browser, click <strong>Re-activate Code</strong> to allow the same code to activate again.</p>
<div class="stats-grid">
  <article class="stat"><span>Total Codes</span><strong>{{ codeStats?.total || 100 }}</strong><small>Lifetime browser licenses</small></article>
  <article class="stat"><span>Available</span><strong style="color:#22c55e">{{ codeStats?.available || 0 }}</strong><small>Ready for new users</small></article>
  <article class="stat"><span>Activated / In Use</span><strong style="color:#f59e0b">{{ codeStats?.used || 0 }}</strong><small>Locked to 1 installation</small></article>
</div>
<form class="code-search" style="display:flex;gap:8px;margin:16px 0;" @submit.prevent="filterCodes">
  <input v-model="codeQuery.code_search" aria-label="Search codes" placeholder="Search 6-digit code…" />
  <select v-model="codeQuery.code_status" aria-label="Filter code status">
    <option value="all">All codes (100)</option>
    <option value="available">Available only</option>
    <option value="used">Used / Active only</option>
  </select>
  <button class="button small">Filter</button>
</form>
<div class="codes-table" style="overflow-x:auto;">
  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Status</th>
        <th>Activated Date</th>
        <th>Device Binding</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in activationCodes" :key="item.id">
        <td>
          <span style="font-family:monospace;font-weight:700;font-size:16px;letter-spacing:2px;background:#1e293b;color:#38bdf8;padding:4px 10px;border-radius:6px;border:1px solid #334155;">{{ item.code }}</span>
        </td>
        <td>
          <span class="pill" :style="item.status === 'available' ? 'border-color:#16a34a;color:#4ade80' : 'border-color:#f59e0b;color:#fbbf24'">
            {{ item.status === 'available' ? 'AVAILABLE' : 'ACTIVE / USED' }}
          </span>
        </td>
        <td>{{ date(item.activated_at) }}</td>
        <td>
          <small v-if="item.device_id" style="font-family:monospace;color:#94a3b8;">{{ item.device_id.slice(0, 16) }}...</small>
          <small v-else class="muted">None (Available)</small>
        </td>
        <td>
          <button v-if="item.status === 'used'" class="button small outline" :disabled="busy" @click="post('/admin/activation-codes/' + item.id + '/reactivate')">
            ↺ Re-activate Code
          </button>
          <span v-else class="pill" style="opacity:0.6;">Ready to use</span>
        </td>
      </tr>
      <tr v-if="!activationCodes || !activationCodes.length">
        <td colspan="5">No activation codes match your search.</td>
      </tr>
    </tbody>
  </table>
</div>
<h3 id="deliveries">Telegram deliveries</h3><p class="fine">{{ deliveries.length }} most recent deliveries. A timeout may still mean Telegram received a message; retry uses the same single-use code.</p><div v-if="!deliveries.length" class="empty-state muted">Your first subscription delivery will appear here.</div><div v-else class="table-wrap"><table><thead><tr><th>Recipient</th><th>Plan</th><th>Delivery</th><th>Sent / Attempts</th><th>Action</th></tr></thead><tbody><tr v-for="item in deliveries" :key="item.id"><td><b>{{ item.name }}</b><small>@{{ item.telegram_username }}</small></td><td>{{ item.plan }} · {{ item.months }} month(s)</td><td><span class="delivery-status" :class="item.status">{{ item.status }}</span><small v-if="item.error">{{ item.error }}</small></td><td>{{ date(item.sent_at) }}<small>{{ item.attempts }} attempts</small></td><td><button v-if="['failed','pending','sending'].includes(item.status)" class="button small outline" :disabled="busy" @click="post('/admin/deliveries/'+item.id+'/retry')">Retry delivery</button><span v-else>—</span></td></tr></tbody></table></div>
<h3 id="support" class="section-title">Support inbox</h3><div v-if="!supportTickets.length" class="empty-state muted">No support requests yet.</div><article v-for="ticket in supportTickets" :key="ticket.id" class="panel support-ticket"><b>#{{ticket.id}} · {{ticket.subject}}</b><small>{{ticket.name}} · @{{ticket.telegram_username||'not linked'}} · {{ticket.status}}</small><p>{{ticket.message}}</p><form @submit.prevent="post('/admin/support/'+ticket.id+'/reply',{reply:replies[ticket.id]??ticket.reply??''})"><label>Reply to member<textarea :value="replies[ticket.id]??ticket.reply??''" @input="replies[ticket.id]=$event.target.value" required maxlength="2000" rows="3"></textarea></label><button class="button small" :disabled="busy">Save reply & send via bot ↗</button></form></article><h3 id="activity" class="section-title">Recent owner activity</h3><div v-for="event in events" :key="event.id" class="event"><b>{{ event.action.replaceAll('-',' ') }}</b><span>{{ event.name }}</span><small>{{ date(event.created_at) }}</small></div></section></Layout></template>
