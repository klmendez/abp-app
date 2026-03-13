export default function PowerBIPage() {
  return (
    <div className="homeShell">
      <section className="homeQuick powerbiLayout">
        <div className="homeQuickHeader">
          <div>
            <h2>Informe Power BI</h2>
            <p>Panel interactivo para consultar métricas.</p>
          </div>
        </div>

        <div className="powerbiEmbed" aria-label="Informe Power BI">
          <iframe
            title="Informe"
            src="https://app.powerbi.com/view?r=eyJrIjoiZTUwMTk0ZmYtZmM4OC00MmVjLTgzMjUtZWM2YmU4NjhhZDU1IiwidCI6ImU4MjE0OTM3LTIzM2ItNGIzNi04NmJmLTBiNWYzMzM3YmVlMSIsImMiOjF9"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}
