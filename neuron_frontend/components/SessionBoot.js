export default function SessionBoot() {
  return (
    <div className="session-boot" role="status" aria-live="polite" aria-label="Loading">
      <span className="session-boot-mark" aria-hidden />
      <span className="session-boot-text">Neuron</span>
    </div>
  );
}
