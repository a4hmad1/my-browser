<script setup>
import { computed } from "vue";
import { Link, useForm } from "@inertiajs/vue3";
import Layout from "../Components/Layout.vue";
import Icon from "../Components/Icon.vue";
const props = defineProps({ mode: String });
const form = useForm({
    name: "",
    email: "",
    telegram_username: "",
    password: "",
    password_confirmation: "",
    token: "",
});
const title = computed(() =>
    props.mode === "register"
        ? "Create your account."
        : props.mode === "reset"
          ? "Reset your password."
          : props.mode === "owner"
            ? "Owner sign in."
          : "Sign in to CineStream.",
);
function submit() {
    form.post(props.mode === "reset" ? "/reset-password" : props.mode === "owner" ? "/owner-login" : "/" + props.mode, {
        onFinish: () => form.reset("password", "password_confirmation"),
    });
}
</script>
<template>
    <Layout
        ><section class="auth-layout">
            <div class="auth-story">
                <p class="eyebrow">YOUR CINEMA. YOUR LANGUAGE.</p>
                <h1>{{ title }}</h1>
                <p class="muted">
                    {{
                        mode === "register"
                            ? "Create your account for a 24-hour free trial. No card required."
                            : mode === "reset"
                              ? "Send /reset to your previously linked Telegram bot. Enter the code it sends here."
                              : mode === "owner"
                                ? "Enter the owner account email and password to open your dashboard."
                                : "Enter your email and password to access your account."
                    }}
                </p>
                <div class="auth-decoration"><img :src="'/images/cinema-hero.png'" alt="A cinematic landscape" /><span><Icon name="shield" /> Private member access</span></div>
            </div>
            <form class="panel auth-form" @submit.prevent="submit">
                <h2>
                    {{
                        mode === "register"
                            ? "Create account"
                            : mode === "reset"
                              ? "Reset password"
                              : mode === "owner"
                                ? "Owner account"
                                : "Sign in"
                    }}
                </h2>
                <label v-if="mode === 'register'"
                    >Your name<input
                        v-model="form.name"
                        autocomplete="name"
                        required
                        maxlength="80" /></label
                ><label
                    >Email address<input
                        v-model="form.email"
                        type="email"
                        autocomplete="email"
                        required /></label
                ><label v-if="mode === 'register'">Telegram username<input v-model="form.telegram_username" placeholder="@your_username" autocomplete="off" required maxlength="33" /><small>Required at registration for private bot verification and subscription codes.</small></label><label v-if="mode === 'reset'"
                    >Telegram reset code<input
                        v-model="form.token"
                        autocomplete="one-time-code"
                        required /></label
                ><label
                    >{{ mode === "reset" ? "New password" : "Password"
                    }}<input
                        v-model="form.password"
                        type="password"
                        :autocomplete="
                            mode === 'login' || mode === 'owner'
                                ? 'current-password'
                                : 'new-password'
                        "
                        :minlength="mode === 'login' || mode === 'owner' ? 1 : 10"
                        required /></label
                ><label v-if="mode === 'register' || mode === 'reset'"
                    >Confirm password<input
                        v-model="form.password_confirmation"
                        type="password"
                        autocomplete="new-password"
                        required
                        minlength="10"
                /></label>
                <p
                    v-for="(error, key) in form.errors"
                    :key="key"
                    class="error"
                    role="alert"
                >
                    {{ error }}
                </p>
                <button class="button" :disabled="form.processing">
                    {{
                        form.processing
                            ? "Please wait…"
                            : mode === "register"
                              ? "Start my free day ↗"
                              : mode === "reset"
                                ? "Update password ↗"
                                : mode === "owner"
                                  ? "Open owner dashboard ↗"
                                  : "Sign in ↗"
                    }}
                </button>
                <p v-if="mode === 'owner'" class="fine">
                    <Link href="/login">Member sign in</Link>
                </p>
                <p v-else-if="mode === 'login'" class="fine">
                    <Link href="/reset-password">Forgot password?</Link> ·
                    <Link href="/register">Create account</Link>
                </p>
                <p v-else class="fine">
                    Already have an account? <Link href="/login">Sign in</Link>
                </p>
            </form>
        </section></Layout
    >
</template>
