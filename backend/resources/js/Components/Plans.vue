<script setup>
import { ref } from "vue";
import { Link, usePage } from "@inertiajs/vue3";
import Icon from "./Icon.vue";
defineProps({ plans: Array });
const yearly = ref(false), page=usePage();
const money = (n) => new Intl.NumberFormat("en").format(n);
</script>
<template>
    <section id="pricing" class="section">
        <div class="section-head">
            <div>
                <p class="eyebrow">A PLAN FOR YOUR MOVIE NIGHTS</p>
                <h2>A little subscription.<br />A better cinema experience.</h2>
            </div>
            <div class="billing">
                <button :class="{ selected: !yearly }" @click="yearly = false">
                    Monthly</button
                ><button :class="{ selected: yearly }" @click="yearly = true">
                    Yearly <span>−5%</span>
                </button>
            </div>
        </div>
        <p class="muted">
            Start with 24 hours free. Browser membership does not include paid
            streaming subscriptions.
        </p>
        <div class="plans">
            <article
                v-for="plan in plans"
                :key="plan.id"
                class="plan"
                :class="{ featured: plan.id === 'plus' }"
            >
                <div class="plan-top">
                    <h3>{{ plan.name }}</h3>
                    <span v-if="plan.id === 'plus'" class="pill"
                        >THE SWEET SPOT</span
                    >
                </div>
                <p class="muted">
                    {{
                        plan.id === "basic"
                            ? "Keep it simple. Press play."
                            : plan.id === "plus"
                              ? "Make your cinema feel like you."
                              : "More room for your movie world."
                    }}
                </p>
                <div class="price">
                    {{ money(yearly ? plan.yearly : plan.monthly) }}
                    <small>IQD / {{ yearly ? "year" : "month" }}</small>
                </div>
                <p class="equivalent">
                    {{
                        yearly
                            ? money(plan.monthly * 0.95) +
                              " IQD / month · billed yearly"
                            : "Monthly membership · manual activation"
                    }}
                </p>
                <Link
                    :href="page.props.user ? '/dashboard?plan='+plan.id+'&months='+(yearly?12:1) : '/register'"
                    class="button"
                    :class="{ outline: plan.id !== 'plus' }"
                    > {{ page.props.user ? "Choose this plan" : "Start your free day" }} <Icon name="arrow" :size="18" /></Link
                >
                <ul>
                    <li v-for="feature in plan.features" :key="feature">
                        <Icon name="check" :size="17" />{{ feature }}
                    </li>
                </ul>
            </article>
        </div>
        <p class="fine">
            After payment approval, the owner sends your activation code through Telegram. No
            automatic charges.
        </p>
    </section>
</template>
