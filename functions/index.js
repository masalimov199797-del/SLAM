/**
 * SLAM: push-уведомление непосредственному руководителю участка,
 * когда в новом чек-листе есть замечание. Без замечаний уведомлений нет.
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const SITES = { zhez: "Жезкентский участок", shem: "Шемонаихинский участок", irt: "Иртышский участок" };
const QSHORT = { 1: "Опыт выполнения", 2: "Знание регламента", 3: "Допуск / наряд-допуск", 4: "Действия при ЧС", 5: "Падение / зажатие",
  6: "СИЗ", 7: "Изоляция энергии", 8: "Воздух и микроклимат", 9: "Оборудование / инструмент", 10: "Люди рядом" };

// Те же правила, что в приложении (Модель_данных.md)
function hasRemark(r) {
  return !!(r.remarks || r.photoCount || (r.flags || []).length || (r.hazards || []).some(h => !h.c));
}
function summary(r) {
  if (r.remarks) return r.remarks;
  const h = (r.hazards || []).find(x => !x.c);
  if (h) return "Опасность без средства контроля: " + h.h;
  if ((r.flags || []).length) return "Опасные ответы: " + r.flags.map(n => QSHORT[n]).join(", ");
  return "Фото нарушения";
}

exports.notifyLeadOnRemark = onDocumentCreated({ document: "reports/{id}", region: "europe-west1" }, async (event) => {
  const r = event.data && event.data.data();
  if (!r || !hasRemark(r)) return;

  const db = getFirestore();
  const leads = await db.collection("leads").where("site", "==", r.site).get();
  if (leads.empty) return;
  const tokens = leads.docs.map(d => d.get("token")).filter(Boolean);
  if (!tokens.length) return;

  const who = [r.worker && r.worker.lastName, r.worker && r.worker.firstName].filter(Boolean).join(" ");
  const title = r.outcome === "stop" ? "Остановка работ: " + who : "Новое замечание: " + who;
  let body = summary(r);
  if (body.length > 140) body = body.slice(0, 137) + "…";
  body += " · " + (SITES[r.site] || "");

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { reportId: String(r.id || event.params.id), site: String(r.site || "") },
    webpush: { notification: { icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "slam-" + event.params.id } }
  });

  // Удаляем токены устройств, которые больше не принимают уведомления
  const dead = [];
  res.responses.forEach((x, i) => {
    const code = x.error && x.error.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(leads.docs[i].ref);
  });
  await Promise.all(dead.map(ref => ref.delete()));
});
