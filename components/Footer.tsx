export default function Footer() {
  return (
    <footer className="w-full px-4 py-4 text-center text-xs" style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--rule)' }}>
      신일교회 청년부 전자투표 · {new Date().getFullYear()}
    </footer>
  );
}
