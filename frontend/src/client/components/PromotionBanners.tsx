import { useState, useEffect } from 'react';
import { clientApi } from '../services/api';

interface PromotionService {
  id: string;
  name: string;
  price: number;
}

interface Promotion {
  id: string;
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  bannerImageUrl: string | null;
  bannerTitle: string | null;
  bannerText: string | null;
  services: PromotionService[];
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function fmtDiscounted(cents: number, pct: number) {
  return ((cents * (100 - pct)) / 10000).toFixed(2).replace('.', ',');
}

export function PromotionBanners() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [current, setCurrent] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    clientApi
      .get<Promotion[]>('/promotions/active')
      .then((res) => setPromotions(res.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % promotions.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [promotions.length]);

  if (isLoading || promotions.length === 0) return null;

  const promo = promotions[current];
  const hasMultiple = promotions.length > 1;
  const pct = promo.discountPercent;
  const title = (promo.bannerTitle || promo.name).toUpperCase();

  const renderTitle = () => {
    const regex = new RegExp(`(${pct}%\\s*OFF?)`, 'i');
    const parts = title.split(regex);
    if (parts.length === 1) return <>{title}</>;
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <em key={i} style={{ fontStyle: 'italic', color: '#d4a032' }}>{part}</em>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="px-5 mb-6 select-none" style={{ pointerEvents: 'none' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Montserrat:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes bannerPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(212,160,50,0.35); }
          50% { box-shadow: 0 4px 30px rgba(212,160,50,0.6); }
        }
        .promo-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          letter-spacing: 2px;
          color: #f5e6c0;
          line-height: 1.2;
          text-transform: uppercase;
          font-size: 18px;
        }
        .promo-cards {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .promo-cards::-webkit-scrollbar { display: none; }
        .promo-card {
          flex: 1 1 0;
          min-width: 80px;
        }
        .promo-svc-name {
          font-size: 7px;
          letter-spacing: 1.5px;
          color: rgba(212,160,50,0.45);
          text-transform: uppercase;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .promo-price-old {
          font-size: 9px;
          color: rgba(212,160,50,0.4);
          text-decoration: line-through;
          letter-spacing: 1px;
          margin-bottom: 2px;
        }
        .promo-price-new {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 600;
          color: #d4a032;
          letter-spacing: 1px;
          line-height: 1;
          font-size: 18px;
        }
        @media (min-width: 640px) {
          .promo-title { font-size: 28px; }
          .promo-cards { gap: 16px; }
          .promo-card { min-width: 100px; }
          .promo-svc-name { font-size: 8px; letter-spacing: 2px; }
          .promo-price-old { font-size: 10px; }
          .promo-price-new { font-size: 28px; }
        }
      `}</style>

      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1c1006 0%, #2a1a08 40%, #1e1208 100%)',
          border: '1px solid rgba(212, 160, 50, 0.2)',
          borderRadius: '4px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {/* Grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
            opacity: 0.4,
          }}
        />

        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-60px',
            right: '-60px',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(212,160,50,0.08) 0%, transparent 70%)',
          }}
        />

        {promo.bannerImageUrl ? (
          /* ====== COM IMAGEM ====== */
          <div className="relative">
            <img src={promo.bannerImageUrl} alt={promo.name} className="w-full object-cover h-40 sm:h-52" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #1c1006 0%, rgba(28,16,6,0.6) 50%, rgba(28,16,6,0.2) 100%)' }} />
            <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <span
                  style={{
                    background: 'linear-gradient(135deg, #d4a032, #b8841e)',
                    color: '#1c1006',
                    fontWeight: 700,
                    fontSize: '10px',
                    letterSpacing: '2px',
                    padding: '5px 12px',
                    borderRadius: '2px',
                    textTransform: 'uppercase',
                    animation: 'bannerPulse 2.5s ease-in-out infinite',
                  }}
                >
                  {pct}% OFF
                </span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(212,160,50,0.4), transparent)' }} />
              </div>

              <p className="promo-title" style={{ marginBottom: '4px' }}>
                {renderTitle()}
              </p>
              {promo.bannerText && (
                <p style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(212,160,50,0.5)', textTransform: 'uppercase' }}>
                  {promo.bannerText}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ====== SEM IMAGEM ====== */
          <div className="relative p-4 sm:p-6">
            {/* Badge + divider line */}
            <div className="flex items-center gap-3 mb-3">
              <span
                style={{
                  background: 'linear-gradient(135deg, #d4a032, #b8841e)',
                  color: '#1c1006',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '2px',
                  padding: '5px 12px',
                  borderRadius: '2px',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                  animation: 'bannerPulse 2.5s ease-in-out infinite',
                }}
              >
                {pct}% OFF
              </span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(212,160,50,0.4), transparent)' }} />
            </div>

            {/* Title */}
            <p className="promo-title" style={{ marginBottom: '4px' }}>
              {renderTitle()}
            </p>

            {/* Subtitle */}
            <p style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(212,160,50,0.5)', textTransform: 'uppercase', marginBottom: '14px' }}>
              {promo.bannerText || 'Oferta por tempo limitado'}
            </p>

            {/* Service cards */}
            {promo.services.length > 0 && (
              <div className="promo-cards">
                {promo.services.map((s, idx) => (
                  <div
                    key={s.id}
                    className="promo-card relative"
                    style={{
                      background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.2) 100%)',
                      border: '1px solid rgba(212,160,50,0.12)',
                      borderRadius: '3px',
                      padding: '10px 10px',
                    }}
                  >
                    {idx === 0 && (
                      <div
                        className="absolute left-0"
                        style={{
                          top: '20%',
                          bottom: '20%',
                          width: '2px',
                          background: 'linear-gradient(to bottom, transparent, #d4a032, transparent)',
                          borderRadius: '2px',
                        }}
                      />
                    )}

                    <p className="promo-svc-name">{s.name}</p>
                    <p className="promo-price-old">R$ {fmtPrice(s.price)}</p>
                    <p className="promo-price-new">R$ {fmtDiscounted(s.price, pct)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dots indicadores */}
      {hasMultiple && (
        <div className="flex justify-center gap-2 mt-3">
          {promotions.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === current ? '24px' : '6px',
                height: '6px',
                background: i === current ? '#d4a032' : 'rgba(212,160,50,0.25)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
