"use client";
import { useActionState } from "react";
import { login } from "@/actions/auth";
import { Submit } from "@/components/forms";
import { Icon } from "@/components/icons";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="stack">
      {state?.error && <div className="alert bad" role="alert"><Icon.alert />{state.error}</div>}
      <input type="hidden" name="next" value={next} />
      <label className="field"><span>الإيميل</span>
        <input type="email" name="email" autoComplete="username" required dir="ltr" placeholder="name@mersal-ngo.org" defaultValue={state?.email} key={state?.email} />
      </label>
      <label className="field"><span>كلمة المرور</span><input type="password" name="password" autoComplete="current-password" required dir="ltr" /></label>
      <Submit className="btn primary block">دخول</Submit>
    </form>
  );
}
