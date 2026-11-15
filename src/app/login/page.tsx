import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Icon, Logo } from "@/components/icons";
import { LoginForm } from "./form";

const SSO_MSG: Record<string, string> = {
  invalid: "رابط الدخول من البوابة غير صالح أو انتهت صلاحيته. افتح النظام من البوابة مرة أخرى.",
  nouser: "حسابك في البوابة غير مسجل في نظام الإدارة الاجتماعية. اطلب من المدير إضافتك.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sso?: string }> }) {
  if (await auth()) redirect("/");
  const { next = "", sso } = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <div className="login-brand"><Logo height={56} /></div>
        <h2>نظام الإدارة الاجتماعية</h2>
        <p className="lead">من القرار حتى استلام المستفيد ومتابعة موقفه</p>
        {sso && SSO_MSG[sso] && <div className="alert warn"><Icon.alert />{SSO_MSG[sso]}</div>}
        <LoginForm next={next} />
        <p className="login-foot">© {new Date().getFullYear()} مؤسسة مرسال</p>
      </div>
    </main>
  );
}
