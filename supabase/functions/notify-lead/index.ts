// SLAM: push-уведомление непосредственному руководителю участка,
// когда в новом чек-листе есть замечание. Без замечаний уведомлений нет.
// Вызывается триггером базы после добавления строки в public.reports.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITES: Record<string, string> = { zhez: "Жезкентский участок", shem: "Шемонаихинский участок", irt: "Иртышский участок" };
const QSHORT: Record<number, string> = { 1: "Опыт выполнения", 2: "Знание регламента", 3: "Допуск / наряд-допуск", 4: "Действия при ЧС",
  5: "Падение / зажатие", 6: "СИЗ", 7: "Изоляция энергии", 8: "Воздух и микроклимат", 9: "Оборудование / инструмент", 10: "Люди рядом" };

// Те же правила, что в приложении
function hasRemark(r: any) {
  return !!(r.remarks || r.photoCount || (r.flags || []).length || (r.hazards || []).some((h: any) => !h.c));
}
function summary(r: any) {
  if (r.remarks) return r.remarks;
  const h = (r.hazards || []).find((x: any) => !x.c);
  if (h) return "Опасность без средства контроля: " + h.h;
  if ((r.flags || []).length) return "Опасные ответы: " + r.flags.map((n: number) => QSHORT[n]).join(", ");
  return "Фото нарушения";
}

Deno.serve(async (req) => {
  const ok = (msg: string) => new Response(msg, { status: 200 });
  const payload = await req.json().catch(() => ({}));
  const id = payload?.record?.id ?? payload?.id;
  if (!id) return new Response("no id", { status: 400 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Берём чек-лист из базы (не доверяем присланному) и помечаем как обработанный ровно один раз
  const { data: claimed } = await sb.from("reports")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id).is("notified_at", null)
    .select("id, site, data");
  const row = claimed && claimed[0];
  if (!row) return ok("already handled");
  const r = row.data || {};
  if (!hasRemark(r)) return ok("no remark");

  const { data: subs } = await sb.from("push_subs").select("endpoint, sub").eq("site", row.site);
  if (!subs || !subs.length) return ok("no subscribers");

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:slam@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const who = [r.worker?.lastName, r.worker?.firstName].filter(Boolean).join(" ");
  let body = summary(r);
  if (body.length > 140) body = body.slice(0, 137) + "…";
  const message = JSON.stringify({
    title: (r.outcome === "stop" ? "Остановка работ: " : "Новое замечание: ") + who,
    body: body + " · " + (SITES[row.site] || ""),
    reportId: row.id,
  });

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.sub, message, { TTL: 86400 });
      sent++;
    } catch (e: any) {
      // Устройство отписалось — удаляем подписку
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }
  return ok("sent " + sent);
});
