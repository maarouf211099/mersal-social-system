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
      <section className="login-art" aria-hidden>
        <img src="/logo-white.png" alt="" width={170} />
        <div>
          <h1>نظام الإدارة الاجتماعية</h1>
          <p>من تسجيل القرار لحد ما الخدمة توصل للمستفيد ونتأكد من استلامها — في مكان واحد.</p>
          <ul>
            <li>استكمال بيانات الاستلام قبل أي صرف</li>
            <li>دفعات الشهر وشيت الحسابات Excel</li>
            <li>متابعة الاستلام وقائمة الغلق</li>
            <li>كل عملية متسجلة باسم اللي عملها ووقتها</li>
          </ul>
        </div>
        <small>© {new Date().getFullYear()} مؤسسة مرسال</small>
      </section>
      <section className="login-pane">
        <div className="login-card">
          <div className="login-brand"><Logo height={52} /></div>
          <h2>تسجيل الدخول</h2>
          <p className="lead">ادخل بإيميل مرسال وكلمة المرور</p>
          {sso && SSO_MSG[sso] && <div className="alert warn"><Icon.alert />{SSO_MSG[sso]}</div>}
          <LoginForm next={next} />
          <p className="login-foot">الإدارة الاجتماعية · مؤسسة مرسال</p>
        </div>
      </section>
    </main>
  );
}
