"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "./icons";

export type State = { error?: string; ok?: string; tempPassword?: string } | undefined;
type Action = (prev: State, form: FormData) => Promise<State>;

export function Submit({ children, className = "btn primary", pendingText = "جارٍ الحفظ…", name, value, disabled }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending || disabled} name={name} value={value}>{pending ? pendingText : children}</button>;
}

export function Feedback({ state, tempPwLabel = "كلمة المرور المؤقتة (تظهر مرة واحدة):" }: { state: State; tempPwLabel?: string }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="alert bad" role="alert"><Icon.alert />{state.error}</div>}
      {state.ok && <div className="alert ok" role="status"><Icon.check />{state.ok}</div>}
      {state.tempPassword && <div className="secret">{tempPwLabel}<code>{state.tempPassword}</code></div>}
    </>
  );
}

/**
 * فورم مربوط بـ server action. ما بيمسحش اللي اتكتب لو السيرفر رفض (عشان الموظف مايعيدش الكتابة)،
 * وبيمسح الفورم بعد النجاح لو resetOnOk. زرار الإرسال (name/value) بيتبعت مع البيانات.
 */
export function ActionForm({ action, children, className = "stack", resetOnOk, id, feedbackTop = true }: {
  action: Action; children: React.ReactNode; className?: string; resetOnOk?: boolean; id?: string; feedbackTop?: boolean;
}) {
  // الإشعار يتبعت لحظة رد السيرفر — قبل ما الصفحة تتحدث والفورم يختفي
  const [state, dispatch, pending] = useActionState(async (prev: State, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.ok && !r.tempPassword) window.dispatchEvent(new CustomEvent("app-toast", { detail: r.ok }));
    return r;
  }, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form ref={ref} id={id} className={className} aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null);
        startTransition(() => dispatch(fd));
      }}>
      {feedbackTop && <Feedback state={state?.tempPassword ? state : state?.error ? { error: state.error } : undefined} />}
      {children}
      {!feedbackTop && <Feedback state={state?.error ? { error: state.error } : undefined} />}
    </form>
  );
}

/** إشعارات النجاح — في الـlayout عشان تفضل ظاهرة بعد تحديث الصفحة */
export function Toaster() {
  const [msgs, setMsgs] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m.slice(-2), { id, text: String((e as CustomEvent).detail) }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 6000);
    };
    window.addEventListener("app-toast", on);
    return () => window.removeEventListener("app-toast", on);
  }, []);
  return <div className="toaster" aria-live="polite">{msgs.map((m) => <div key={m.id} className="alert ok toast-msg" role="status"><Icon.check />{m.text}</div>)}</div>;
}
