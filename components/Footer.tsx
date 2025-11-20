export default function Footer() {
  return (
    <footer className="w-full py-4 px-4 text-center border-t" style={{
      borderColor: 'rgba(0, 0, 0, 0.06)',
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(10px)'
    }}>
      <div className="text-xs text-gray-500" style={{ letterSpacing: '-0.01em', lineHeight: '1.6' }}>
        <span className="font-semibold">System Version 1.0.0</span>
        {' | '}
        <span>Designed and Developed by Moon</span>
        <br className="sm:hidden" />
        <span className="hidden sm:inline"> | </span>
        <span>Copyright  2025 신일교회 청년부. All Rights Reserved.</span>
      </div>
    </footer>
  );
}
