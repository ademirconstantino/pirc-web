import { useEffect } from 'react';
import { VERSION } from '../irc/constants';

/** Minimum time the splash is shown, in milliseconds */
const SPLASH_TIME = 1500;

/** The pIRC splash screen: a loading bar when pIRC starts, the splash image from Arquivo > Sobre */
export default function Splash({ onClose, auto }: { onClose: () => void; auto: boolean }) {
  useEffect(() => {
    if (!auto) {
      return;
    }
    const timer = setTimeout(onClose, SPLASH_TIME);
    return () => clearTimeout(timer);
  }, [auto, onClose]);

  if (auto) {
    return (
      <div className="splash" onClick={onClose}>
        <div className="loading">
          <div className="loading-title">pIRC {VERSION}</div>
          <div className="loading-bar" role="progressbar" aria-label="Carregando pIRC">
            <div className="loading-fill" style={{ animationDuration: `${SPLASH_TIME}ms` }} />
          </div>
          <div className="loading-text">Carregando…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="splash" role="dialog" aria-label="pIRC" onClick={onClose}>
      <div className="splash-box">
        <img src="images/splash.gif" alt="pIRC - portable IRC" width={450} height={238} />
        <div className="splash-credits">
          <p>
            <strong>pIRC {VERSION}</strong> — portable IRC, versão web
          </p>
          <p>Criado em 2026 por Ademir Constantino, com a colaboração de João Pedrosa.</p>
          <p>Software livre, distribuído sob a GNU General Public License versão 2 ou posterior.</p>
        </div>
      </div>
    </div>
  );
}
