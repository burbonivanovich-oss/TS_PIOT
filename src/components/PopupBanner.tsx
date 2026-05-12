import { useEffect, useState } from 'react';

const STORAGE_KEY = 'popup_dismissed_v1';
const DELAY_MS = 60_000;

export default function PopupBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return;
		const timer = setTimeout(() => setVisible(true), DELAY_MS);
		return () => clearTimeout(timer);
	}, []);

	const dismiss = () => {
		setVisible(false);
		localStorage.setItem(STORAGE_KEY, '1');
	};

	if (!visible) return null;

	return (
		<>
			<style>{`
				.pb-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0,0,0,.45);
					z-index: 300;
					display: flex;
					align-items: flex-end;
					justify-content: center;
					padding: 0 16px 24px;
					animation: pb-fade-in .25s ease;
				}
				@keyframes pb-fade-in {
					from { opacity: 0; }
					to   { opacity: 1; }
				}
				.pb-card {
					background: #111;
					color: #fff;
					width: 100%;
					max-width: 540px;
					padding: 32px 32px 28px;
					position: relative;
					animation: pb-slide-up .3s ease;
				}
				@keyframes pb-slide-up {
					from { transform: translateY(24px); opacity: 0; }
					to   { transform: translateY(0);    opacity: 1; }
				}
				.pb-close {
					position: absolute;
					top: 14px;
					right: 16px;
					background: none;
					border: none;
					cursor: pointer;
					font-size: 1rem;
					color: #666;
					line-height: 1;
					padding: 4px;
					transition: color .15s;
				}
				.pb-close:hover { color: #fff; }
				.pb-eyebrow {
					font-size: .65rem;
					font-weight: 700;
					letter-spacing: .14em;
					text-transform: uppercase;
					color: #AFCC00;
					margin-bottom: 10px;
				}
				.pb-title {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.7rem;
					letter-spacing: .04em;
					line-height: 1.05;
					color: #fff;
					margin: 0 0 10px;
					text-transform: uppercase;
				}
				.pb-text {
					font-size: .875rem;
					color: #bbb;
					line-height: 1.55;
					margin: 0 0 22px;
				}
				.pb-cta {
					display: inline-block;
					background: #AFCC00;
					color: #111;
					text-decoration: none;
					padding: .6em 1.4em;
					font-size: .78rem;
					font-weight: 700;
					letter-spacing: .1em;
					text-transform: uppercase;
					transition: background .12s;
				}
				.pb-cta:hover { background: #9E2B4F; color: #fff; }
				@media (max-width: 560px) {
					.pb-card { padding: 24px 20px 20px; }
					.pb-title { font-size: 1.4rem; }
				}
			`}</style>
			<div className="pb-overlay" onClick={(e) => e.target === e.currentTarget && dismiss()}>
				<div className="pb-card" role="dialog" aria-modal="true" aria-label="Полезная рассылка">
					<button className="pb-close" onClick={dismiss} aria-label="Закрыть">✕</button>
					<div className="pb-eyebrow">Без спама</div>
					<h2 className="pb-title">Важные изменения — раз в две недели</h2>
					<p className="pb-text">
						Дайджест по ТС ПИоТ, маркировке и налогам: только то, что влияет на кассу и учёт.
						Первое письмо — шпаргалка по срокам 2026 года.
					</p>
					<a href="#subscribe" className="pb-cta" onClick={dismiss}>Подписаться →</a>
				</div>
			</div>
		</>
	);
}
