/** هيكل تحميل يظهر فوراً أثناء التنقل بين الصفحات */
export default function Loading() {
  return (
    <div className="skel-page" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="skel" style={{ height: 28, width: 240 }} />
      <div className="skel" style={{ height: 14, width: 380, maxWidth: "80%" }} />
      <div className="skel" style={{ height: 40, marginTop: 10 }} />
      <div className="skel" style={{ height: 76 }} />
      <div className="skel" style={{ height: 320 }} />
    </div>
  );
}
