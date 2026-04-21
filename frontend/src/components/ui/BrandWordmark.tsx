interface BrandWordmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { barb: 'text-[20px]', amer: 'text-[16px]', diamond: 'text-[7px]', line: 'w-5' },
  md: { barb: 'text-[28px]', amer: 'text-[23px]', diamond: 'text-[9px]', line: 'w-7' },
  lg: { barb: 'text-[36px]', amer: 'text-[30px]', diamond: 'text-[11px]', line: 'w-10' },
  xl: { barb: 'text-[44px]', amer: 'text-[36px]', diamond: 'text-[13px]', line: 'w-12' },
};

export function BrandWordmark({ size = 'md', className = '' }: BrandWordmarkProps) {
  const s = sizeMap[size];

  return (
    <div
      className={`relative text-center leading-[1.05] select-none ${className}`}
      style={{ fontFamily: "'Rye', serif" }}
    >
      <div
        className={`${s.barb} tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-b from-[#F2D68A] via-[#D4A556] to-[#8B6914] drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]`}
      >
        BARBEARIA
      </div>
      <div className="flex items-center justify-center gap-1.5 my-1">
        <span className={`h-px ${s.line} bg-gradient-to-r from-transparent to-[#C8923A]/60`} />
        <span className={`text-[#C8923A] ${s.diamond}`}>◆</span>
        <span className={`h-px ${s.line} bg-gradient-to-l from-transparent to-[#C8923A]/60`} />
      </div>
      <div
        className={`${s.amer} tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-b from-[#D85050] via-[#A63030] to-[#6B1A1A] drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]`}
      >
        AMÉRICA
      </div>
    </div>
  );
}
