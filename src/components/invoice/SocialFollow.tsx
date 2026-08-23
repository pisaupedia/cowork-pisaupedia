import { COMPANY_PROFILE } from '@/lib/constants';

// Footer "Follow us" statis di bagian bawah setiap dokumen (Invoice/
// Delivery Note/Quotation) — dipertahankan dari aplikasi invoice standalone
// yang lama (SVG ikon TikTok & Instagram apa adanya dari file aslinya).
export function SocialFollow() {
  return (
    <div className="iv-social-follow">
      <span className="iv-social-label">Follow us</span>
      <div className="iv-social-item">
        <span className="iv-social-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="10" fill="#111" />
            <path
              fill="#fff"
              d="M31.5 12.5c.7 3.3 3 5.6 6.5 6.1v4.7c-2.4.1-4.5-.6-6.5-1.9v10.1c0 5.3-3.5 9-8.6 9-3.4 0-6.2-1.6-7.8-4.4-1.9-3.3-1.4-8.1 1.2-10.9 2.2-2.4 5.3-3.4 8.5-2.9v4.9c-.8-.3-1.7-.4-2.6-.2-1.7.4-3 1.7-3.4 3.4-.4 1.9.4 3.8 2 4.8 1.5 1 3.6 1 5-.2 1-.9 1.5-2.1 1.5-3.6V12.5h4.2z"
            />
          </svg>
        </span>
        <span>{COMPANY_PROFILE.socialTiktok}</span>
      </div>
      <div className="iv-social-item">
        <span className="iv-social-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FED576" />
                <stop offset="26%" stopColor="#F47133" />
                <stop offset="61%" stopColor="#BC3081" />
                <stop offset="100%" stopColor="#4C63D2" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="10" fill="url(#igGrad)" />
            <rect x="12" y="12" width="24" height="24" rx="7" fill="none" stroke="#fff" strokeWidth="2.4" />
            <circle cx="24" cy="24" r="6.2" fill="none" stroke="#fff" strokeWidth="2.4" />
            <circle cx="32" cy="16" r="1.8" fill="#fff" />
          </svg>
        </span>
        <span>{COMPANY_PROFILE.socialInstagram}</span>
      </div>
    </div>
  );
}
