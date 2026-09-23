export default function CrowdPanel({ crowd }) {
  if (!crowd || !crowd.headcount) {
    return (
      <div className="empty-state">
        <p>No crowd read yet.</p>
      </div>
    );
  }

  const groups = crowd.group_types || {};

  return (
    <div>
      <div className="row-between">
        <div className="stat">
          <div className="value">{crowd.headcount}</div>
          <div className="label">Headcount</div>
        </div>
        <span className="badge">{crowd.scenario}</span>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="row-between" style={{ marginBottom: 4 }}>
          <span className="label" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Energy level
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {Math.round((crowd.energy_level || 0) * 100)}%
          </span>
        </div>
        <div className="meter">
          <div className="meter-fill" style={{ "--meter": crowd.energy_level || 0 }} />
        </div>
      </div>

      <div className="crowd-grid">
        <div className="stat">
          <div className="value">{groups.families_pct ?? 0}%</div>
          <div className="label">Families</div>
        </div>
        <div className="stat">
          <div className="value">{groups.young_adults_pct ?? 0}%</div>
          <div className="label">Young adults</div>
        </div>
        <div className="stat">
          <div className="value">{groups.want_to_dance_pct ?? 0}%</div>
          <div className="label">Want to dance</div>
        </div>
      </div>
    </div>
  );
}
