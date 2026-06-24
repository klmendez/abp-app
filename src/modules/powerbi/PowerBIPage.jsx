export default function PowerBIPage() {
  return (
    <div className="pageContent">
      <div className="pageInner powerbiLayout">
        

        <div className="powerbiEmbed" aria-label="Informe Power BI">
          <iframe
            title="Informe"
            src="https://app.powerbi.com/view?r=eyJrIjoiZTUwMTk0ZmYtZmM4OC00MmVjLTgzMjUtZWM2YmU4NjhhZDU1IiwidCI6ImU4MjE0OTM3LTIzM2ItNGIzNi04NmJmLTBiNWYzMzM3YmVlMSIsImMiOjF9"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
