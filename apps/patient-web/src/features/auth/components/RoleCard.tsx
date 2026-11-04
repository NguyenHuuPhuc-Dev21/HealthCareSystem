interface RoleCardProps {
  icon: string;
  title: string;
  description: string;
  nextLabel: string;
  selected: boolean;
  onSelect: () => void;
}

/** Thẻ chọn vai trò khi đăng ký lần đầu (SH2). */
export function RoleCard({ icon, title, description, nextLabel, selected, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      className={`role-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="role-card__icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="role-card__next">{nextLabel} →</div>
    </button>
  );
}
