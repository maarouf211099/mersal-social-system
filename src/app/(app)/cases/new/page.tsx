import { redirect } from "next/navigation";

/** مفيش تسجيل حالة لوحدها: الكود بيتسجل مع القرار */
export default function NewCasePage() {
  redirect("/decisions/new");
}
